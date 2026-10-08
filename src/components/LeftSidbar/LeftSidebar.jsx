import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css'
import assets from '../../assets/assets'
import { auth, db, logout } from '../../config/firebase'

import {
    collection,
    getDocs,
    onSnapshot,
    orderBy,
    query
} from 'firebase/firestore'

import { AppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'


const LeftSidebar = ({ onUserSelect }) => {

    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");

    // Latest message of every chat
    const [lastMessages, setLastMessages] = useState({});

    // Unread messages of every chat
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


    // Load users
    useEffect(() => {

        fetchUsers();

    }, []);


    // Listen to latest message + unread messages
    useEffect(() => {

        if (
            !auth.currentUser ||
            users.length === 0
        ) {
            return;
        }


        const unsubscribeFunctions = [];

        const currentUserId =
            auth.currentUser.uid;


        users.forEach((user) => {

            const selectedUserId =
                user.id;


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


            // Get latest message
            const q = query(
                messagesRef,
                orderBy("createdAt", "desc")
            );


            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {

                    if (snapshot.empty) {

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


                    const messages =
                        snapshot.docs.map(
                            (messageDoc) => ({
                                id: messageDoc.id,
                                ...messageDoc.data()
                            })
                        );


                    // Latest message
                    const latestMessage =
                        messages[0];


                    setLastMessages((prev) => ({
                        ...prev,
                        [user.id]: latestMessage
                    }));


                    // Count unread received messages
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


        return () => {

            unsubscribeFunctions.forEach(
                (unsubscribe) =>
                    unsubscribe()
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


    // Message preview
    const getMessagePreview = (message) => {

        if (!message) {
            return "";
        }

        if (message.image) {
            return "📷 Image";
        }

        return message.text || "";

    };


    // Select user
    const handleUserClick = (user) => {

        setSelectedUser(user);


        // Open selected chat on mobile
        if (onUserSelect) {
            onUserSelect();
        }

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
                        placeholder="Search here.."
                        value={search}
                        onChange={(e) =>
                            setSearch(
                                e.target.value
                            )
                        }
                    />

                </div>

            </div>


            {/* Users */}

            <div className="ls-list">

                {filteredUsers.map((user) => {

                    const lastMessage =
                        lastMessages[user.id];

                    const unreadCount =
                        unreadCounts[user.id] || 0;


                    return (

                        <div
                            key={user.id}

                            className={
                                `friends ${
                                    selectedUser?.id ===
                                    user.id
                                        ? "selected"
                                        : ""
                                }`
                            }

                            onClick={() =>
                                handleUserClick(user)
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
                                        {
                                            user.name ||
                                            user.username ||
                                            user.email
                                        }
                                    </p>


                                    {lastMessage && (

                                        <span className="last-time">
                                            {
                                                formatTime(
                                                    lastMessage.createdAt
                                                )
                                            }
                                        </span>

                                    )}

                                </div>


                                <div className="friend-bottom">

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

export default LeftSidebar