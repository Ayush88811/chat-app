
import React, { useContext, useEffect, useRef, useState } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { auth, db } from '../../config/firebase'
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore'
import uploadImage from '../../lib/upload'

const ChatBox = ({ onInfoClick }) => {
    const { selectedUser, setSelectedUser, userData } = useContext(AppContext)

    const currentUserId = auth.currentUser?.uid

    const [messages, setMessages] = useState([])
    const [message, setMessage] = useState('')
    const [selectedUserData, setSelectedUserData] = useState(null)
    const [editingMessageId, setEditingMessageId] = useState(null)
    const [editText, setEditText] = useState('')
    const [menuMessageId, setMenuMessageId] = useState(null)

    const messagesEndRef = useRef(null)

    // Keep the selected user's profile updated.
    useEffect(() => {
        if (!selectedUser?.id) {
            setSelectedUserData(null)
            return
        }

        const userRef = doc(db, 'users', selectedUser.id)

        const unsubscribe = onSnapshot(
            userRef,
            (snapshot) => {
                setSelectedUserData(
                    snapshot.exists() ? snapshot.data() : null
                )
            },
            (error) => {
                console.error('Error loading user profile:', error)
            }
        )

        return () => unsubscribe()
    }, [selectedUser?.id])

    // Verify contact membership and avoid overwriting existing participants.
    const ensureChatDocument = async (senderId, receiverId) => {
        if (!senderId || !receiverId || senderId === receiverId) {
            throw new Error('Invalid chat participants.')
        }

        const sortedPair = [senderId, receiverId].sort()
        const chatId = sortedPair.join('_')

        const contactRef = doc(db, 'contacts', chatId)
        const contactSnapshot = await getDoc(contactRef)

        if (!contactSnapshot.exists()) {
            throw new Error(
                'You can chat only after the friend request is accepted.'
            )
        }

        const contactData = contactSnapshot.data()

        if (
            !Array.isArray(contactData.users) ||
            contactData.users.length !== 2 ||
            !contactData.users.includes(senderId) ||
            !contactData.users.includes(receiverId)
        ) {
            throw new Error('The accepted contact details are invalid.')
        }

        const chatRef = doc(db, 'chats', chatId)
        const chatSnapshot = await getDoc(chatRef)

        if (chatSnapshot.exists()) {
            const chatData = chatSnapshot.data()

            // Check both participants without changing their stored order.
            if (
                !Array.isArray(chatData.participants) ||
                chatData.participants.length !== 2 ||
                !chatData.participants.includes(senderId) ||
                !chatData.participants.includes(receiverId)
            ) {
                throw new Error('The chat participants are invalid.')
            }

            // Important: do not write participants to an existing chat.
            // Your Firestore Rules allow existing chats to update lastMessage only.
            return chatId
        }

        // Create a chat document only if it does not already exist.
        // Firestore Rules must allow checking a missing chat document.
        await setDoc(chatRef, {
            participants: sortedPair
        })

        return chatId
    }

    // Load messages after verifying the accepted contact and chat.
    useEffect(() => {
        let unsubscribeMessages = null
        let cancelled = false

        const loadMessages = async () => {
            if (!currentUserId || !selectedUser?.id) {
                setMessages([])
                return
            }

            const selectedUserId = selectedUser.id

            if (currentUserId === selectedUserId) {
                setMessages([])
                return
            }

            setMessages([])

            try {
                const chatId = await ensureChatDocument(
                    currentUserId,
                    selectedUserId
                )

                if (cancelled) return

                const messagesRef = collection(
                    db,
                    'chats',
                    chatId,
                    'messages'
                )

                const messagesQuery = query(
                    messagesRef,
                    orderBy('createdAt', 'asc')
                )

                unsubscribeMessages = onSnapshot(
                    messagesQuery,
                    (snapshot) => {
                        const messagesList = snapshot.docs.map(
                            (messageDoc) => ({
                                id: messageDoc.id,
                                ...messageDoc.data()
                            })
                        )

                        setMessages(messagesList)

                        // Mark received messages as read.
                        messagesList.forEach((msg) => {
                            if (
                                msg.receiverId === currentUserId &&
                                msg.read === false
                            ) {
                                updateDoc(
                                    doc(
                                        db,
                                        'chats',
                                        chatId,
                                        'messages',
                                        msg.id
                                    ),
                                    { read: true }
                                ).catch((error) => {
                                    console.error(
                                        'Error marking message as read:',
                                        error
                                    )
                                })
                            }
                        })
                    },
                    (error) => {
                        console.error(
                            'Error loading messages:',
                            error.code,
                            error.message
                        )
                    }
                )
            } catch (error) {
                if (!cancelled) {
                    setMessages([])
                    console.error(
                        'Could not open chat:',
                        error.code || '',
                        error.message
                    )
                }
            }
        }

        loadMessages()

        return () => {
            cancelled = true
            if (unsubscribeMessages) unsubscribeMessages()
        }
    }, [currentUserId, selectedUser?.id])

    // Scroll to the latest message.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth'
        })
    }, [messages])

    const isUserOnline = () => {
        if (!selectedUserData?.lastSeen) return false

        return Date.now() - selectedUserData.lastSeen < 2 * 60 * 1000
    }

    const formatLastSeen = () => {
        if (!selectedUserData?.lastSeen) return 'Offline'
        if (isUserOnline()) return 'Online'

        return `Last seen ${new Date(
            selectedUserData.lastSeen
        ).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}`
    }

    // Send a text message.
    const sendMessage = async () => {
        if (!message.trim() || !selectedUser?.id || !auth.currentUser) {
            return
        }

        const textToSend = message.trim()
        const senderId = auth.currentUser.uid
        const receiverId = selectedUser.id

        try {
            const chatId = await ensureChatDocument(senderId, receiverId)

            await addDoc(
                collection(db, 'chats', chatId, 'messages'),
                {
                    senderId,
                    receiverId,
                    text: textToSend,
                    read: false,
                    createdAt: serverTimestamp()
                }
            )

            // Update the preview after the message has been saved.
            await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: {
                    text: textToSend,
                    senderId,
                    createdAt: serverTimestamp()
                }
            })

            setMessage('')
        } catch (error) {
            console.error('Error sending message:', {
                code: error.code,
                message: error.message
            })
        }
    }

    // Upload an image to Cloudinary and send its URL.
    const sendImage = async (file) => {
        if (!file || !selectedUser?.id || !auth.currentUser) return

        try {
            const senderId = auth.currentUser.uid
            const receiverId = selectedUser.id

            const imageUrl = await uploadImage(file)
            const chatId = await ensureChatDocument(senderId, receiverId)

            await addDoc(
                collection(db, 'chats', chatId, 'messages'),
                {
                    senderId,
                    receiverId,
                    text: '',
                    image: imageUrl,
                    read: false,
                    createdAt: serverTimestamp()
                }
            )

            await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: {
                    text: '📷 Image',
                    senderId,
                    createdAt: serverTimestamp()
                }
            })
        } catch (error) {
            console.error('Error sending image:', {
                code: error.code,
                message: error.message
            })
        }
    }

    const handleImageChange = (event) => {
        const file = event.target.files?.[0]

        if (file) sendImage(file)

        // Allow selecting the same image again.
        event.target.value = ''
    }

    const startEdit = (msg) => {
        setEditingMessageId(msg.id)
        setEditText(msg.text || '')
        setMenuMessageId(null)
    }

    const cancelEdit = () => {
        setEditingMessageId(null)
        setEditText('')
    }

    // Edit a message sent by the current user.
    const saveEdit = async () => {
        if (
            !editText.trim() ||
            !editingMessageId ||
            !selectedUser?.id ||
            !auth.currentUser
        ) {
            return
        }

        try {
            const chatId = [
                auth.currentUser.uid,
                selectedUser.id
            ].sort().join('_')

            const latestMessage = messages[messages.length - 1]

            await updateDoc(
                doc(db, 'chats', chatId, 'messages', editingMessageId),
                {
                    text: editText.trim(),
                    edited: true
                }
            )

            if (latestMessage?.id === editingMessageId) {
                await updateDoc(doc(db, 'chats', chatId), {
                    lastMessage: {
                        text: editText.trim(),
                        senderId: auth.currentUser.uid,
                        createdAt: latestMessage.createdAt
                    }
                })
            }

            cancelEdit()
        } catch (error) {
            console.error('Error editing message:', {
                code: error.code,
                message: error.message
            })
        }
    }

    // Delete a message sent by the current user.
    const deleteMessage = async (messageId) => {
        if (!selectedUser?.id || !auth.currentUser) return

        try {
            const chatId = [
                auth.currentUser.uid,
                selectedUser.id
            ].sort().join('_')

            await deleteDoc(
                doc(db, 'chats', chatId, 'messages', messageId)
            )

            setMenuMessageId(null)
        } catch (error) {
            console.error('Error deleting message:', {
                code: error.code,
                message: error.message
            })
        }
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()

            if (editingMessageId) {
                saveEdit()
            } else {
                sendMessage()
            }
        }
    }

    const formatTime = (timestamp) => {
        if (!timestamp?.toDate) return ''

        return timestamp.toDate().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="chat-box">
            {/* Chat header */}
            <div className="chat-user">
                <button
                    type="button"
                    className="mobile-back"
                    onClick={() => setSelectedUser(null)}
                    aria-label="Back to chats"
                >
                    ←
                </button>

                <img
                    src={
                        selectedUserData?.avatar ||
                        selectedUser?.avatar ||
                        assets.profile_img
                    }
                    alt="User profile"
                />

                <div className="chat-user-name">
                    <p>
                        {selectedUserData?.name ||
                            selectedUser?.name ||
                            selectedUser?.username ||
                            'Select a user'}
                    </p>

                    {selectedUser && (
                        <div className="user-status">
                            {isUserOnline() && (
                                <span className="online-dot" />
                            )}
                            <span>{formatLastSeen()}</span>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    className="info-button"
                    onClick={onInfoClick}
                    aria-label="Open user profile"
                    title="User information"
                >
                    <img
                        src={assets.help_icon}
                        className="help"
                        alt=""
                    />
                </button>
            </div>

            {/* Messages */}
            <div className="chat-msg">
                {!selectedUser ? (
                    <p className="no-message">
                        Select a user to start chatting
                    </p>
                ) : messages.length === 0 ? (
                    <p className="no-message">No messages yet</p>
                ) : (
                    messages.map((msg) => {
                        const isSender =
                            msg.senderId === auth.currentUser?.uid

                        return (
                            <div
                                key={msg.id}
                                className={isSender ? 's-msg' : 'r-msg'}
                            >
                                {editingMessageId === msg.id ? (
                                    <div className="edit-box">
                                        <input
                                            type="text"
                                            value={editText}
                                            onChange={(event) =>
                                                setEditText(event.target.value)
                                            }
                                            onKeyDown={handleKeyDown}
                                            autoFocus
                                        />

                                        <div className="edit-buttons">
                                            <button
                                                type="button"
                                                onClick={saveEdit}
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {msg.image ? (
                                            <img
                                                className="msg-img"
                                                src={msg.image}
                                                alt="Shared image"
                                            />
                                        ) : (
                                            <p className="msg">
                                                {msg.text}
                                                {msg.edited && (
                                                    <span className="edited-text">
                                                        {' '}edited
                                                    </span>
                                                )}
                                            </p>
                                        )}

                                        {isSender && (
                                            <div className="message-options">
                                                <button
                                                    type="button"
                                                    className="more-btn"
                                                    onClick={() =>
                                                        setMenuMessageId(
                                                            menuMessageId === msg.id
                                                                ? null
                                                                : msg.id
                                                        )
                                                    }
                                                    aria-label="Message options"
                                                >
                                                    ⋮
                                                </button>

                                                {menuMessageId === msg.id && (
                                                    <div className="message-menu">
                                                        {!msg.image && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    startEdit(msg)
                                                                }
                                                            >
                                                                Edit
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                deleteMessage(msg.id)
                                                            }
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="msg-info">
                                    <img
                                        src={
                                            isSender
                                                ? userData?.avatar ||
                                                  assets.profile_img
                                                : selectedUserData?.avatar ||
                                                  selectedUser?.avatar ||
                                                  assets.profile_img
                                        }
                                        alt=""
                                    />

                                    <p>{formatTime(msg.createdAt)}</p>

                                    {isSender && (
                                        <span
                                            className={
                                                msg.read
                                                    ? 'read-status read'
                                                    : 'read-status'
                                            }
                                        >
                                            {msg.read ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="chat-input">
                <input
                    type="text"
                    placeholder="Send a message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                />

                <input
                    type="file"
                    id="image"
                    accept="image/png, image/jpeg"
                    hidden
                    onChange={handleImageChange}
                />

                <label htmlFor="image">
                    <img
                        src={assets.gallery_icon}
                        alt="Choose image"
                    />
                </label>

                <img
                    src={assets.send_button}
                    alt="Send message"
                    className="send-button"
                    onClick={sendMessage}
                />
            </div>
        </div>
    )
}

export default ChatBox
