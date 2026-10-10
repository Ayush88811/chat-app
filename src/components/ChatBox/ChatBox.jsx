
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

    const [messages, setMessages] = useState([])
    const [message, setMessage] = useState('')
    const [selectedUserData, setSelectedUserData] = useState(null)
    const [editingMessageId, setEditingMessageId] = useState(null)
    const [editText, setEditText] = useState('')
    const [menuMessageId, setMenuMessageId] = useState(null)

    const messagesEndRef = useRef(null)

    // Keep the selected user's profile updated
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

    // Listen for messages in the selected chat
    useEffect(() => {
        const currentUserId = auth.currentUser?.uid
        const selectedUserId = selectedUser?.id

        if (!currentUserId || !selectedUserId) {
            setMessages([])
            return
        }

        const chatId = [currentUserId, selectedUserId].sort().join('_')
        const messagesRef = collection(db, 'chats', chatId, 'messages')
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'))

        const unsubscribe = onSnapshot(
            messagesQuery,
            (snapshot) => {
                const messagesList = snapshot.docs.map((messageDoc) => ({
                    id: messageDoc.id,
                    ...messageDoc.data()
                }))

                setMessages(messagesList)

                // Mark received messages as read
                messagesList.forEach(async (msg) => {
                    if (
                        msg.receiverId === currentUserId &&
                        msg.read === false
                    ) {
                        try {
                            await updateDoc(
                                doc(db, 'chats', chatId, 'messages', msg.id),
                                { read: true }
                            )
                        } catch (error) {
                            console.error('Error marking message as read:', error)
                        }
                    }
                })
            },
            (error) => {
                console.error('Error loading messages:', error)
            }
        )

        return () => unsubscribe()
    }, [selectedUser?.id])

    // Scroll to the newest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const isUserOnline = () => {
        if (!selectedUserData?.lastSeen) return false

        return Date.now() - selectedUserData.lastSeen < 2 * 60 * 1000
    }

    const formatLastSeen = () => {
        if (!selectedUserData?.lastSeen) return 'Offline'
        if (isUserOnline()) return 'Online'

        return `Last seen ${new Date(selectedUserData.lastSeen).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}`
    }

    // Create the chat document before adding its first message
    const ensureChatDocument = async (currentUserId, selectedUserId) => {
        const chatId = [currentUserId, selectedUserId].sort().join('_')

        await setDoc(
            doc(db, 'chats', chatId),
            {
                participants: [currentUserId, selectedUserId].sort()
            },
            { merge: true }
        )

        return chatId
    }

    // Send a text message
    const sendMessage = async () => {
        if (!message.trim() || !selectedUser?.id || !auth.currentUser) {
            return
        }

        const textToSend = message.trim()
        const currentUserId = auth.currentUser.uid
        const selectedUserId = selectedUser.id

        try {
            // Ensure participants exist before writing messages
            const chatId = await ensureChatDocument(
                currentUserId,
                selectedUserId
            )

            const messagesRef = collection(db, 'chats', chatId, 'messages')

            await addDoc(messagesRef, {
                senderId: currentUserId,
                receiverId: selectedUserId,
                text: textToSend,
                read: false,
                createdAt: serverTimestamp()
            })

            setMessage('')

            // Update the latest message shown in the sidebar
            await setDoc(
                doc(db, 'chats', chatId),
                {
                    lastMessage: {
                        text: textToSend,
                        senderId: currentUserId,
                        createdAt: serverTimestamp()
                    }
                },
                { merge: true }
            )
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    // Upload an image to Cloudinary and send its URL
    const sendImage = async (file) => {
        if (!file || !selectedUser?.id || !auth.currentUser) {
            return
        }

        try {
            const currentUserId = auth.currentUser.uid
            const selectedUserId = selectedUser.id

            const imageUrl = await uploadImage(file)

            // Create or update the chat before adding the image message
            const chatId = await ensureChatDocument(
                currentUserId,
                selectedUserId
            )

            const messagesRef = collection(db, 'chats', chatId, 'messages')

            await addDoc(messagesRef, {
                senderId: currentUserId,
                receiverId: selectedUserId,
                text: '',
                image: imageUrl,
                read: false,
                createdAt: serverTimestamp()
            })

            await setDoc(
                doc(db, 'chats', chatId),
                {
                    lastMessage: {
                        text: '📷 Image',
                        senderId: currentUserId,
                        createdAt: serverTimestamp()
                    }
                },
                { merge: true }
            )
        } catch (error) {
            console.error('Error sending image:', error)
        }
    }

    const handleImageChange = (event) => {
        const file = event.target.files?.[0]

        if (file) sendImage(file)

        // Let the same image be selected again later
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

    // Save edited text
    const saveEdit = async () => {
        if (!editText.trim() || !editingMessageId || !selectedUser?.id || !auth.currentUser) {
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

            // Update the sidebar preview if this was the latest message
            if (latestMessage?.id === editingMessageId) {
                await setDoc(
                    doc(db, 'chats', chatId),
                    {
                        lastMessage: {
                            text: editText.trim(),
                            senderId: auth.currentUser.uid,
                            createdAt: latestMessage.createdAt
                        }
                    },
                    { merge: true }
                )
            }

            cancelEdit()
        } catch (error) {
            console.error('Error editing message:', error)
        }
    }

    // Delete a message sent by the current user
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
            console.error('Error deleting message:', error)
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
                                <span className="online-dot"></span>
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
                    <p className="no-message">Select a user to start chatting</p>
                ) : messages.length === 0 ? (
                    <p className="no-message">No messages yet</p>
                ) : (
                    messages.map((msg) => {
                        const isSender = msg.senderId === auth.currentUser?.uid

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
                                            onChange={(event) => setEditText(event.target.value)}
                                            onKeyDown={handleKeyDown}
                                            autoFocus
                                        />
                                        <div className="edit-buttons">
                                            <button type="button" onClick={saveEdit}>Save</button>
                                            <button type="button" onClick={cancelEdit}>Cancel</button>
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
                                                    <span className="edited-text"> edited</span>
                                                )}
                                            </p>
                                        )}

                                        {isSender && (
                                            <div className="message-options">
                                                <button
                                                    type="button"
                                                    className="more-btn"
                                                    onClick={() => setMenuMessageId(
                                                        menuMessageId === msg.id ? null : msg.id
                                                    )}
                                                    aria-label="Message options"
                                                >
                                                    ⋮
                                                </button>

                                                {menuMessageId === msg.id && (
                                                    <div className="message-menu">
                                                        {!msg.image && (
                                                            <button type="button" onClick={() => startEdit(msg)}>
                                                                Edit
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteMessage(msg.id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Avatar, time and read receipt */}
                                <div className="msg-info">
                                    <img
                                        src={
                                            isSender
                                                ? userData?.avatar || assets.profile_img
                                                : selectedUserData?.avatar ||
                                                  selectedUser?.avatar ||
                                                  assets.profile_img
                                        }
                                        alt=""
                                    />

                                    <p>{formatTime(msg.createdAt)}</p>

                                    {isSender && (
                                        <span className={msg.read ? 'read-status read' : 'read-status'}>
                                            {msg.read ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}

                <div ref={messagesEndRef}></div>
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
                    <img src={assets.gallery_icon} alt="Choose image" />
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
