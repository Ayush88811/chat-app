import React, { useContext, useEffect, useRef, useState } from 'react'
import './ChatBox.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContext';
import { auth, db } from '../../config/firebase';

import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';

import uploadImage from '../../lib/upload';


const ChatBox = () => {

    const { selectedUser, userData } = useContext(AppContext);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");

    // Selected user's latest data
    const [selectedUserData, setSelectedUserData] = useState(null);

    // Edit message states
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editText, setEditText] = useState("");

    // Message menu
    const [menuMessageId, setMenuMessageId] = useState(null);

    // Auto-scroll
    const messagesEndRef = useRef(null);


    // Get selected user's latest profile data
    useEffect(() => {

        if (!selectedUser?.id) {
            setSelectedUserData(null);
            return;
        }

        const userRef = doc(
            db,
            "users",
            selectedUser.id
        );

        const unsubscribe = onSnapshot(
            userRef,
            (snapshot) => {

                if (snapshot.exists()) {
                    setSelectedUserData(snapshot.data());
                }

            }
        );

        return () => unsubscribe();

    }, [selectedUser?.id]);


    // Get messages in real time
    useEffect(() => {

        if (!selectedUser || !auth.currentUser) {
            setMessages([]);
            return;
        }

        const currentUserId =
            auth.currentUser.uid;

        const selectedUserId =
            selectedUser.id;

        // Same chat id for both users
        const chatId = [
            currentUserId,
            selectedUserId
        ]
            .sort()
            .join("_");


        const messagesRef = collection(
            db,
            "chats",
            chatId,
            "messages"
        );


        // Get old messages first
        const q = query(
            messagesRef,
            orderBy("createdAt", "asc")
        );


        // Listen for new messages
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {

                const messagesList =
                    snapshot.docs.map((messageDoc) => ({
                        id: messageDoc.id,
                        ...messageDoc.data()
                    }));


                setMessages(messagesList);


                // Mark received unread messages as read
                messagesList.forEach(async (msg) => {

                    if (
                        msg.receiverId === currentUserId &&
                        msg.read === false
                    ) {

                        try {

                            await updateDoc(
                                doc(
                                    db,
                                    "chats",
                                    chatId,
                                    "messages",
                                    msg.id
                                ),
                                {
                                    read: true
                                }
                            );

                        } catch (error) {

                            console.error(
                                "Error marking message as read:",
                                error
                            );

                        }

                    }

                });

            },
            (error) => {

                console.error(
                    "Error loading messages:",
                    error
                );

            }
        );


        return () => unsubscribe();

    }, [selectedUser]);


    // Scroll to latest message
    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


    // Check online status
    const isUserOnline = () => {

        if (!selectedUserData?.lastSeen) {
            return false;
        }

        return (
            Date.now() -
            selectedUserData.lastSeen <
            2 * 60 * 1000
        );

    };


    // Format last seen
    const formatLastSeen = () => {

        if (!selectedUserData?.lastSeen) {
            return "Offline";
        }

        if (isUserOnline()) {
            return "Online";
        }

        const lastSeen = new Date(
            selectedUserData.lastSeen
        );

        return `Last seen ${lastSeen.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })}`;

    };


    // Send text message
    const sendMessage = async () => {

        if (!message.trim() || !selectedUser) {
            return;
        }

        try {

            const currentUserId =
                auth.currentUser.uid;

            const selectedUserId =
                selectedUser.id;


            const chatId = [
                currentUserId,
                selectedUserId
            ]
                .sort()
                .join("_");


            const messagesRef = collection(
                db,
                "chats",
                chatId,
                "messages"
            );


            // Add new message
            await addDoc(messagesRef, {

                senderId: currentUserId,
                receiverId: selectedUserId,
                text: message.trim(),

                // Receiver has not read it yet
                read: false,

                createdAt: serverTimestamp()

            });


            // Update latest message
            await setDoc(
                doc(
                    db,
                    "chats",
                    chatId
                ),
                {
                    lastMessage: {
                        text: message.trim(),
                        senderId: currentUserId,
                        createdAt: serverTimestamp()
                    }
                },
                {
                    merge: true
                }
            );


            // Clear input
            setMessage("");

        } catch (error) {

            console.error(
                "Error sending message:",
                error
            );

        }

    };


    // Send image through Cloudinary
    const sendImage = async (file) => {

        if (!file || !selectedUser) {
            return;
        }

        try {

            const currentUserId =
                auth.currentUser.uid;

            const selectedUserId =
                selectedUser.id;


            // Upload image to Cloudinary
            const imageUrl =
                await uploadImage(file);


            const chatId = [
                currentUserId,
                selectedUserId
            ]
                .sort()
                .join("_");


            const messagesRef = collection(
                db,
                "chats",
                chatId,
                "messages"
            );


            // Add image message
            await addDoc(messagesRef, {

                senderId: currentUserId,
                receiverId: selectedUserId,
                text: "",
                image: imageUrl,

                // Receiver has not read it yet
                read: false,

                createdAt: serverTimestamp()

            });


            // Update latest message
            await setDoc(
                doc(
                    db,
                    "chats",
                    chatId
                ),
                {
                    lastMessage: {
                        text: "📷 Image",
                        senderId: currentUserId,
                        createdAt: serverTimestamp()
                    }
                },
                {
                    merge: true
                }
            );

        } catch (error) {

            console.error(
                "Error sending image:",
                error
            );

        }

    };


    // Handle image selection
    const handleImageChange = (e) => {

        const file = e.target.files[0];

        if (file) {
            sendImage(file);
        }

    };


    // Start editing
    const startEdit = (msg) => {

        setEditingMessageId(msg.id);
        setEditText(msg.text || "");

        setMenuMessageId(null);

    };


    // Cancel editing
    const cancelEdit = () => {

        setEditingMessageId(null);
        setEditText("");

    };


    // Save edited message
    const saveEdit = async () => {

        if (
            !editText.trim() ||
            !editingMessageId ||
            !selectedUser
        ) {
            return;
        }

        try {

            const chatId = [
                auth.currentUser.uid,
                selectedUser.id
            ]
                .sort()
                .join("_");


            await updateDoc(
                doc(
                    db,
                    "chats",
                    chatId,
                    "messages",
                    editingMessageId
                ),
                {
                    text: editText.trim(),
                    edited: true
                }
            );


            // Update last message if this
            // edited message is the latest one
            const latestMessage =
                messages[messages.length - 1];


            if (
                latestMessage?.id ===
                editingMessageId
            ) {

                await setDoc(
                    doc(
                        db,
                        "chats",
                        chatId
                    ),
                    {
                        lastMessage: {
                            text: editText.trim(),
                            senderId:
                                auth.currentUser.uid,
                            createdAt:
                                latestMessage.createdAt
                        }
                    },
                    {
                        merge: true
                    }
                );

            }


            cancelEdit();

        } catch (error) {

            console.error(
                "Error editing message:",
                error
            );

        }

    };


    // Delete message
    const deleteMessage = async (messageId) => {

        if (!selectedUser) {
            return;
        }

        try {

            const chatId = [
                auth.currentUser.uid,
                selectedUser.id
            ]
                .sort()
                .join("_");


            await deleteDoc(
                doc(
                    db,
                    "chats",
                    chatId,
                    "messages",
                    messageId
                )
            );


            setMenuMessageId(null);

        } catch (error) {

            console.error(
                "Error deleting message:",
                error
            );

        }

    };


    // Send message with Enter
    const handleKeyDown = (e) => {

        if (e.key === "Enter") {

            if (editingMessageId) {
                saveEdit();
            } else {
                sendMessage();
            }

        }

    };


    // Format message time
    const formatTime = (timestamp) => {

        if (!timestamp?.toDate) {
            return "";
        }

        return timestamp
            .toDate()
            .toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

    };


    return (
        <div className='chat-box'>


            {/* Chat header */}

            <div className="chat-user">

                <img
                    src={
                        selectedUserData?.avatar ||
                        selectedUser?.avatar ||
                        assets.profile_img
                    }
                    alt=""
                />


                <div className="chat-user-name">

                    <p>
                        {selectedUserData?.name ||
                            selectedUser?.name ||
                            selectedUser?.username ||
                            "Select a user"}
                    </p>


                    {selectedUser && (

                        <div className="user-status">

                            {isUserOnline() && (
                                <span className="online-dot"></span>
                            )}

                            <span>
                                {formatLastSeen()}
                            </span>

                        </div>

                    )}

                </div>


                <img
                    src={assets.help_icon}
                    className='help'
                    alt=""
                />

            </div>


            {/* Messages */}

            <div className="chat-msg">

                {!selectedUser ? (

                    <p className="no-message">
                        Select a user to start chatting
                    </p>

                ) : messages.length === 0 ? (

                    <p className="no-message">
                        No messages yet
                    </p>

                ) : (

                    messages.map((msg) => {

                        const isSender =
                            msg.senderId ===
                            auth.currentUser.uid;


                        return (

                            <div
                                key={msg.id}
                                className={
                                    isSender
                                        ? "s-msg"
                                        : "r-msg"
                                }
                            >


                                {/* Edit mode */}

                                {editingMessageId === msg.id ? (

                                    <div className="edit-box">

                                        <input
                                            type="text"
                                            value={editText}
                                            onChange={(e) =>
                                                setEditText(
                                                    e.target.value
                                                )
                                            }
                                            onKeyDown={
                                                handleKeyDown
                                            }
                                            autoFocus
                                        />


                                        <div className="edit-buttons">

                                            <button
                                                onClick={
                                                    saveEdit
                                                }
                                            >
                                                Save
                                            </button>

                                            <button
                                                onClick={
                                                    cancelEdit
                                                }
                                            >
                                                Cancel
                                            </button>

                                        </div>

                                    </div>

                                ) : (

                                    <>

                                        {/* Image or text */}

                                        {msg.image ? (

                                            <img
                                                className="msg-img"
                                                src={msg.image}
                                                alt="message"
                                            />

                                        ) : (

                                            <p className="msg">

                                                {msg.text}

                                                {msg.edited && (
                                                    <span className="edited-text">
                                                        {" "}edited
                                                    </span>
                                                )}

                                            </p>

                                        )}


                                        {/* Message menu */}

                                        {isSender && (

                                            <div className="message-options">

                                                <button
                                                    className="more-btn"
                                                    onClick={() =>
                                                        setMenuMessageId(
                                                            menuMessageId ===
                                                                msg.id
                                                                ? null
                                                                : msg.id
                                                        )
                                                    }
                                                >
                                                    ⋮
                                                </button>


                                                {menuMessageId ===
                                                    msg.id && (

                                                    <div className="message-menu">

                                                        {/* Images cannot be edited */}
                                                        {!msg.image && (
                                                            <button
                                                                onClick={() =>
                                                                    startEdit(
                                                                        msg
                                                                    )
                                                                }
                                                            >
                                                                Edit
                                                            </button>
                                                        )}


                                                        <button
                                                            onClick={() =>
                                                                deleteMessage(
                                                                    msg.id
                                                                )
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


                                {/* Avatar + time + read status */}

                                <div className="msg-info">

                                    <img
                                        src={
                                            isSender
                                                ? (
                                                    userData?.avatar ||
                                                    assets.profile_img
                                                )
                                                : (
                                                    selectedUserData?.avatar ||
                                                    selectedUser?.avatar ||
                                                    assets.profile_img
                                                )
                                        }
                                        alt=""
                                    />


                                    <p>
                                        {formatTime(
                                            msg.createdAt
                                        )}
                                    </p>


                                    {/* Read receipt */}

                                    {isSender && (

                                        <span
                                            className={
                                                msg.read
                                                    ? "read-status read"
                                                    : "read-status"
                                            }
                                        >
                                            {msg.read
                                                ? "✓✓"
                                                : "✓"}
                                        </span>

                                    )}

                                </div>

                            </div>

                        );

                    })

                )}


                {/* Auto scroll target */}

                <div ref={messagesEndRef}></div>

            </div>


            {/* Message input */}

            <div className="chat-input">

                <input
                    type="text"
                    placeholder="Send a message"
                    value={message}
                    onChange={(e) =>
                        setMessage(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                />


                {/* Image input */}

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
                        alt="gallery"
                    />

                </label>


                {/* Send button */}

                <img
                    src={assets.send_button}
                    alt="send"
                    className="send-button"
                    onClick={sendMessage}
                />

            </div>

        </div>
    )
}

export default ChatBox;