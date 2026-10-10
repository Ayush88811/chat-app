import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css'
import assets from '../../assets/assets'
import { auth, db, logout } from '../../config/firebase'

import {
    collection,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    where
} from 'firebase/firestore'

import { AppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'

const LeftSidebar = ({ onUserSelect }) => {
    const [users, setUsers] = useState([])
    const [search, setSearch] = useState('')
    const [lastMessages, setLastMessages] = useState({})
    const [unreadCounts, setUnreadCounts] = useState({})
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState('')

    const { selectedUser, setSelectedUser } = useContext(AppContext)
    const navigate = useNavigate()

    // Load all users except the currently logged-in user
    useEffect(() => {
        let isMounted = true

        const fetchUsers = async () => {
            try {
                setLoading(true)
                setFetchError('')

                const currentUser = auth.currentUser

                if (!currentUser) {
                    if (isMounted) {
                        setUsers([])
                        setFetchError('Please log in to view users.')
                    }
                    return
                }

                const usersRef = collection(db, 'users')
                const snapshot = await getDocs(usersRef)

                const usersList = snapshot.docs
                    .map((userDoc) => ({
                        ...userDoc.data(),
                        id: userDoc.id
                    }))
                    .filter((user) => user.id !== currentUser.uid)

                if (isMounted) {
                    setUsers(usersList)
                }
            } catch (error) {
                console.error('Error fetching users:', {
                    code: error.code,
                    message: error.message
                })

                if (isMounted) {
                    setFetchError(
                        error.code === 'permission-denied'
                            ? 'Permission denied while loading users. Check Firestore Rules.'
                            : 'Could not load users. Please refresh the page.'
                    )
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        fetchUsers()

        return () => {
            isMounted = false
        }
    }, [])

    // Listen for chats involving the current user
    useEffect(() => {
        const currentUserId = auth.currentUser?.uid

        if (!currentUserId || users.length === 0) {
            setLastMessages({})
            setUnreadCounts({})
            return
        }

        let messageUnsubscribers = []

        const chatsRef = collection(db, 'chats')
        const userChatsQuery = query(
            chatsRef,
            where('participants', 'array-contains', currentUserId)
        )

        const unsubscribeChats = onSnapshot(
            userChatsQuery,
            (chatSnapshot) => {
                // Clean up old message listeners before recreating them
                messageUnsubscribers.forEach((unsubscribe) => unsubscribe())
                messageUnsubscribers = []

                const activeUserIds = new Set()

                chatSnapshot.docs.forEach((chatDoc) => {
                    const chatData = chatDoc.data()
                    const participants = chatData.participants

                    if (!Array.isArray(participants)) {
                        return
                    }

                    const otherUserId = participants.find(
                        (uid) => uid !== currentUserId
                    )

                    // Only show chats belonging to users in our user list
                    if (
                        !otherUserId ||
                        !users.some((user) => user.id === otherUserId)
                    ) {
                        return
                    }

                    activeUserIds.add(otherUserId)

                    const messagesRef = collection(
                        db,
                        'chats',
                        chatDoc.id,
                        'messages'
                    )

                    const messagesQuery = query(
                        messagesRef,
                        orderBy('createdAt', 'desc')
                    )

                    const unsubscribeMessages = onSnapshot(
                        messagesQuery,
                        (messagesSnapshot) => {
                            const messages = messagesSnapshot.docs.map(
                                (messageDoc) => ({
                                    id: messageDoc.id,
                                    ...messageDoc.data()
                                })
                            )

                            const latestMessage = messages[0] || null

                            const unreadCount = messages.filter(
                                (message) =>
                                    message.receiverId === currentUserId &&
                                    message.read === false
                            ).length

                            setLastMessages((previous) => ({
                                ...previous,
                                [otherUserId]: latestMessage
                            }))

                            setUnreadCounts((previous) => ({
                                ...previous,
                                [otherUserId]: unreadCount
                            }))
                        },
                        (error) => {
                            console.error(
                                `Error loading messages for ${otherUserId}:`,
                                {
                                    code: error.code,
                                    message: error.message
                                }
                            )
                        }
                    )

                    messageUnsubscribers.push(unsubscribeMessages)
                })

                // Remove previews for users who have no chat
                setLastMessages((previous) => {
                    const updated = { ...previous }

                    users.forEach((user) => {
                        if (!activeUserIds.has(user.id)) {
                            delete updated[user.id]
                        }
                    })

                    return updated
                })

                setUnreadCounts((previous) => {
                    const updated = { ...previous }

                    users.forEach((user) => {
                        if (!activeUserIds.has(user.id)) {
                            delete updated[user.id]
                        }
                    })

                    return updated
                })
            },
                (error) => {
                console.error("Chat listener error code:", error.code);
                console.error("Chat listener error message:", error.message);
                console.log("Logged-in UID:", auth.currentUser?.uid);
            }
        )

        return () => {
            unsubscribeChats()
            messageUnsubscribers.forEach((unsubscribe) => unsubscribe())
        }
    }, [users])

    // Filter users by name, username or email
    const filteredUsers = users.filter((user) => {
        const searchText = search.toLowerCase().trim()

        return (
            user.name?.toLowerCase().includes(searchText) ||
            user.username?.toLowerCase().includes(searchText) ||
            user.email?.toLowerCase().includes(searchText)
        )
    })

    // Format the latest message time
    const formatTime = (timestamp) => {
        if (!timestamp?.toDate) {
            return ''
        }

        return timestamp.toDate().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Show a short preview of the latest message
    const getMessagePreview = (message) => {
        if (!message) {
            return ''
        }

        if (message.image) {
            return '📷 Image'
        }

        return message.text || ''
    }

    // Open the selected user's chat
    const handleUserClick = (user) => {
        setSelectedUser(user)
        onUserSelect?.()
    }

    // Open the profile editing page
    const handleEditProfile = () => {
        navigate('/profile')
    }

    // Log out the current user
    const handleLogout = async () => {
        try {
            await logout()
            setSelectedUser(null)
            navigate('/')
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    return (
        <div className="ls">
            <div className="ls-top">
                <div className="ls-nav">
                    <img
                        src={assets.logo}
                        className="logo"
                        alt="Chatapp"
                    />

                    <div className="menu">
                        <img
                            src={assets.menu_icon}
                            alt="Menu"
                        />

                        <div className="sub-menu">
                            <p onClick={handleEditProfile}>
                                Edit Profile
                            </p>

                            <hr />

                            <p onClick={handleLogout}>
                                Logout
                            </p>
                        </div>
                    </div>
                </div>

                <div className="ls-search">
                    <img
                        src={assets.search_icon}
                        alt="Search"
                    />

                    <input
                        type="text"
                        placeholder="Search here..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            </div>

            <div className="ls-list">
                {loading ? (
                    <p className="ls-message">Loading users...</p>
                ) : fetchError ? (
                    <p className="ls-message">{fetchError}</p>
                ) : filteredUsers.length === 0 ? (
                    <p className="ls-message">
                        {users.length === 0
                            ? 'No other users registered yet.'
                            : 'No users found.'}
                    </p>
                ) : (
                    filteredUsers.map((user) => {
                        const lastMessage = lastMessages[user.id]
                        const unreadCount = unreadCounts[user.id] || 0

                        return (
                            <div
                                key={user.id}
                                className={`friends ${
                                    selectedUser?.id === user.id
                                        ? 'selected'
                                        : ''
                                }`}
                                onClick={() => handleUserClick(user)}
                            >
                                <img
                                    src={user.avatar || assets.profile_img}
                                    alt="User avatar"
                                />

                                <div className="friend-info">
                                    <div className="friend-name-row">
                                        <p>
                                            {user.name ||
                                                user.username ||
                                                user.email ||
                                                'Unknown user'}
                                        </p>

                                        {lastMessage && (
                                            <span className="last-time">
                                                {formatTime(
                                                    lastMessage.createdAt
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    <div className="friend-bottom">
                                        <span className="last-message">
                                            {lastMessage
                                                ? getMessagePreview(lastMessage)
                                                : user.bio ||
                                                  'Start a conversation'}
                                        </span>

                                        {unreadCount > 0 && (
                                            <span className="unread-count">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

export default LeftSidebar
