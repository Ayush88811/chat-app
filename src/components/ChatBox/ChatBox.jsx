import React, { useContext, useEffect, useRef, useState } from 'react'
import './ChatBox.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContext';
import { auth, db } from '../../config/firebase';

import {
    addDoc,
    collection,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp
} from 'firebase/firestore';

import uploadImage from '../../lib/upload';


const ChatBox = () => {

    // Get selected user and current user's data
    const { selectedUser, userData } = useContext(AppContext);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");

    // Used to scroll to the latest message
    const messagesEndRef = useRef(null);


    // Get messages whenever selected user changes
    useEffect(() => {

        if (!selectedUser || !auth.currentUser) {
            setMessages([]);
            return;
        }

        const currentUserId = auth.currentUser.uid;
        const selectedUserId = selectedUser.id;

        // Same chat id for both users
        const chatId = [currentUserId, selectedUserId]
            .sort()
            .join("_");

        const messagesRef = collection(
            db,
            "chats",
            chatId,
            "messages"
        );

        // Get messages in old -> new order
        const q = query(
            messagesRef,
            orderBy("createdAt", "asc")
        );

        // Listen for new messages in real time
        const unsubscribe = onSnapshot(q, (snapshot) => {

            const messagesList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));

            setMessages(messagesList);

        });

        // Remove listener when user changes
        return () => unsubscribe();

    }, [selectedUser]);


    // Scroll to the latest message
    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


    // Send text message
    const sendMessage = async () => {

        if (!message.trim() || !selectedUser) {
            return;
        }

        try {

            const currentUserId = auth.currentUser.uid;
            const selectedUserId = selectedUser.id;

            const chatId = [currentUserId, selectedUserId]
                .sort()
                .join("_");

            const messagesRef = collection(
                db,
                "chats",
                chatId,
                "messages"
            );

            await addDoc(messagesRef, {

                senderId: currentUserId,
                receiverId: selectedUserId,
                text: message.trim(),

                // Firebase server time
                createdAt: serverTimestamp()

            });

            // Clear input after sending
            setMessage("");

        } catch (error) {

            console.error("Error sending message:", error);

        }
    };


    // Send image message through Cloudinary
    const sendImage = async (file) => {

        if (!file || !selectedUser) {
            return;
        }

        try {

            const currentUserId = auth.currentUser.uid;
            const selectedUserId = selectedUser.id;

            // Upload image to Cloudinary
            const imageUrl = await uploadImage(file);

            const chatId = [currentUserId, selectedUserId]
                .sort()
                .join("_");

            const messagesRef = collection(
                db,
                "chats",
                chatId,
                "messages"
            );

            await addDoc(messagesRef, {

                senderId: currentUserId,
                receiverId: selectedUserId,
                text: "",
                image: imageUrl,
                createdAt: serverTimestamp()

            });

        } catch (error) {

            console.error("Error sending image:", error);

        }
    };


    // Handle image selection
    const handleImageChange = (e) => {

        const file = e.target.files[0];

        if (file) {
            sendImage(file);
        }

    };


    // Send message when Enter is pressed
    const handleKeyDown = (e) => {

        if (e.key === "Enter") {
            sendMessage();
        }

    };


    // Convert Firebase timestamp to readable time
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
                        selectedUser?.avatar ||
                        assets.profile_img
                    }
                    alt=""
                />

                <div className="chat-user-name">

                    <p>
                        {selectedUser?.name ||
                            selectedUser?.username ||
                            "Select a user"}
                    </p>

                    {/* Green online dot */}
                    {selectedUser && (
                        <span className="online-dot"></span>
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

                        // Check whether message was sent by current user
                        const isSender =
                            msg.senderId === auth.currentUser.uid;

                        return (
                            <div
                                key={msg.id}
                                className={
                                    isSender
                                        ? "s-msg"
                                        : "r-msg"
                                }
                            >

                                {/* Show image or text */}
                                {msg.image ? (

                                    <img
                                        className="msg-img"
                                        src={msg.image}
                                        alt="message"
                                    />

                                ) : (

                                    <p className="msg">
                                        {msg.text}
                                    </p>

                                )}


                                {/* Avatar and message time */}

                                <div className="msg-info">

                                    <img
                                        src={
                                            isSender
                                                ? (
                                                    userData?.avatar ||
                                                    assets.profile_img
                                                )
                                                : (
                                                    selectedUser?.avatar ||
                                                    assets.profile_img
                                                )
                                        }
                                        alt=""
                                    />

                                    <p>
                                        {formatTime(msg.createdAt)}
                                    </p>

                                </div>

                            </div>
                        );

                    })

                )}

                {/* Keeps the chat at the latest message */}
                <div ref={messagesEndRef}></div>

            </div>


            {/* Message input */}

            <div className="chat-input">

                <input
                    type="text"
                    placeholder="Send a message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
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