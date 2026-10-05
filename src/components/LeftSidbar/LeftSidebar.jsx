import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { auth, db } from '../../config/firebase';
import {
    collection,
    getDocs,
    doc,
    onSnapshot
} from 'firebase/firestore';
import { AppContext } from '../../context/AppContext';

const LeftSidebar = () => {

    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");

    // Store latest message of each user
    const [lastMessages, setLastMessages] = useState({});

    // Get selected user from context
    const { selectedUser, setSelectedUser } = useContext(AppContext);


    // Fetch all users from Firebase
    const fetchUsers = async () => {

        try {

            const userRef = collection(db, "users");

            const snapshot = await getDocs(userRef);

            const usersList = snapshot.docs
                .map((doc) => ({
                    ...doc.data(),
                    id: doc.id
                }))
                // Don't show logged in user
                .filter((user) => user.id !== auth.currentUser.uid);

            setUsers(usersList);

        } catch (error) {

            console.error("Error fetching users:", error);

        }

    };


    // Fetch users when sidebar loads
    useEffect(() => {

        fetchUsers();

    }, []);


    // Listen for latest message of each user
    useEffect(() => {

        if (!auth.currentUser || users.length === 0) {
            return;
        }

        const unsubscribeFunctions = [];

        users.forEach((user) => {

            const currentUserId = auth.currentUser.uid;
            const selectedUserId = user.id;

            // Same chat id for both users
            const chatId = [currentUserId, selectedUserId]
                .sort()
                .join("_");

            const chatRef = doc(db, "chats", chatId);

            // Listen for changes in chat document
            const unsubscribe = onSnapshot(chatRef, (snapshot) => {

                if (snapshot.exists()) {

                    const data = snapshot.data();

                    setLastMessages((prev) => ({
                        ...prev,
                        [user.id]: data.lastMessage || null
                    }));

                }

            });

            unsubscribeFunctions.push(unsubscribe);

        });


        // Remove all listeners when component unmounts
        return () => {

            unsubscribeFunctions.forEach((unsubscribe) => {
                unsubscribe();
            });

        };

    }, [users]);


    // Filter users based on search
    const filteredUsers = users.filter((user) => {

        const searchText = search.toLowerCase();

        return (
            user.name?.toLowerCase().includes(searchText) ||
            user.username?.toLowerCase().includes(searchText) ||
            user.email?.toLowerCase().includes(searchText)
        );

    });


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

                            <p>Edit Profile</p>

                            <hr />

                            <p>Logout</p>

                        </div>

                    </div>

                </div>


                {/* Search box */}

                <div className='ls-search'>

                    <img
                        src={assets.search_icon}
                        alt=""
                    />

                    <input
                        type="text"
                        placeholder='Search here..'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                </div>

            </div>


            {/* User list */}

            <div className="ls-list">

                {filteredUsers.map((user) => {

                    const lastMessage = lastMessages[user.id];

                    return (

                        <div
                            key={user.id}

                            // Highlight selected user
                            className={`friends ${
                                selectedUser?.id === user.id
                                    ? "selected"
                                    : ""
                            }`}

                            // Open this user's chat
                            onClick={() => setSelectedUser(user)}
                        >

                            <img
                                src={
                                    user.avatar ||
                                    assets.profile_img
                                }
                                alt=""
                            />

                            <div>

                                <p>
                                    {user.name || user.username}
                                </p>

                                <span>

                                    {lastMessage
                                        ? lastMessage.text
                                        : user.bio}

                                </span>

                            </div>

                        </div>

                    );

                })}

            </div>

        </div>
    )
}

export default LeftSidebar;