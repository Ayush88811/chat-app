import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { auth, db, logout } from '../../config/firebase';

import {
    collection,
    getDocs,
    onSnapshot,
    orderBy,
    query
} from 'firebase/firestore';

import { AppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';


const LeftSidebar = () => {

    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");

    // Store latest message of every chat
    const [lastMessages, setLastMessages] = useState({});

    // Store unread count of every chat
    const [unreadCounts, setUnreadCounts] = useState({});

    const {
        selectedUser,
        setSelectedUser
    } = useContext(AppContext);

    const navigate = useNavigate();


    // Fetch all users
    const fetchUsers = async () => {

        try {

            const userRef = collection(db, "users");

            const snapshot = await getDocs(userRef);

            const usersList = snapshot.docs
                .map((doc) => ({
                    ...doc.data(),
                    id: doc.id
                }))
                .filter(
                    (user) =>
                        user.id !== auth.currentUser?.uid
                );

            setUsers(usersList);

        } catch (error) {

            console.error(
                "Error fetching users:",
                error
            );

        }

    };


    // Load users when sidebar opens
    useEffect(() => {

        fetchUsers();

    }, []);


    // Listen for latest message and unread messages
    useEffect(() => {

        if (!auth.currentUser || users.length === 0) {
            return;
        }

        const unsubscribeFunctions = [];

        const currentUserId =
            auth.currentUser.uid;


        users.forEach((user) => {

            const selectedUserId = user.id;


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


            // Get all messages ordered by time
            const q = query(
                messagesRef,
                orderBy("createdAt", "desc")
            );


            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {

                    // Convert messages into array
                    const messages = snapshot.docs.map(
                        (messageDoc) => ({
                            id: messageDoc.id,
                            ...messageDoc.data()
                        })
                    );


                    // No messages
                    if (messages.length === 0) {

                        setLastMessages((prev) => ({
                            ...prev,
                            [user.id]: null
                        }));

                        setUnreadCounts((prev) => ({
                            ...prev,
                            [user.id]: 0
                        }));

                        return;

                    }


                    // Latest message
                    const latestMessage =
                        messages[0];


                    setLastMessages((prev) => ({
                        ...prev,
                        [user.id]: latestMessage
                    }));


                    // Count messages received by current user
                    // which are still unread
                    const unreadCount =
                        messages.filter(
                            (msg) =>
                                msg.receiverId ===
                                    currentUserId &&
                                msg.read === false
                        ).length;


                    setUnreadCounts((prev) => ({
                        ...prev,
                        [user.id]: unreadCount
                    }));

                },
                (error) => {

                    console.error(
                        "Error loading messages:",
                        error
                    );

                }
            );


            unsubscribeFunctions.push(
                unsubscribe
            );

        });


        // Remove listeners
        return () => {

            unsubscribeFunctions.forEach(
                (unsubscribe) => unsubscribe()
            );

        };

    }, [users]);


    // Search users
    const filteredUsers = users.filter(
        (user) => {

            const searchText =
                search.toLowerCase();

            return (
                user.name
                    ?.toLowerCase()
                    .includes(searchText) ||

                user.username
                    ?.toLowerCase()
                    .includes(searchText) ||

                user.email
                    ?.toLowerCase()
                    .includes(searchText)
            );

        }
    );


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


    // Show message preview
    const getMessagePreview = (message) => {

        if (!message) {
            return "";
        }

        if (message.image) {
            return "📷 Image";
        }

        return message.text || "";

    };


    // Edit profile
    const handleEditProfile = () => {

        navigate("/profile");

    };


    // Logout
    const handleLogout = async () => {

        try {

            await logout();

            setSelectedUser(null);

            navigate("/");

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

    };


    return (
        <div className='ls'>

            <div className="ls-top">

                <div className="ls-nav">

                    <img
                        src={assets.logo}
                        className='logo'
                        alt=""
                    />

                    <div className='menu'>

                        <img
                            src={assets.menu_icon}
                            alt=""
                        />

                        <div className="sub-menu">

                            <p
                                onClick={
                                    handleEditProfile
                                }
                            >
                                Edit Profile
                            </p>

                            <hr />

                            <p
                                onClick={
                                    handleLogout
                                }
                            >
                                Logout
                            </p>

                        </div>

                    </div>

                </div>


                {/* Search */}

                <div className='ls-search'>

                    <img
                        src={assets.search_icon}
                        alt=""
                    />

                    <input
                        type="text"
                        placeholder='Search here..'
                        value={search}
                        onChange={(e) =>
                            setSearch(
                                e.target.value
                            )
                        }
                    />

                </div>

            </div>


            {/* User list */}

            <div className="ls-list">

                {filteredUsers.map((user) => {

                    const lastMessage =
                        lastMessages[user.id];

                    const unreadCount =
                        unreadCounts[user.id] || 0;


                    return (

                        <div
                            key={user.id}

                            className={`friends ${
                                selectedUser?.id === user.id
                                    ? "selected"
                                    : ""
                            }`}

                            onClick={() =>
                                setSelectedUser(user)
                            }
                        >

                            <img
                                src={
                                    user.avatar ||
                                    assets.profile_img
                                }
                                alt=""
                            />


                            <div className="friend-info">

                                <div className="friend-name-row">

                                    <p>
                                        {user.name ||
                                            user.username}
                                    </p>

                                    {lastMessage && (
                                        <span className="last-time">
                                            {formatTime(
                                                lastMessage.createdAt
                                            )}
                                        </span>
                                    )}

                                </div>


                                <div className="friend-message-row">

                                    <span className="last-message">

                                        {lastMessage
                                            ? getMessagePreview(
                                                lastMessage
                                            )
                                            : user.bio}

                                    </span>


                                    {/* Unread count */}

                                    {unreadCount > 0 && (
                                        <span className="unread-count">
                                            {unreadCount}
                                        </span>
                                    )}

                                </div>

                            </div>

                        </div>

                    );

                })}

            </div>

        </div>
    )
}

export default LeftSidebar;