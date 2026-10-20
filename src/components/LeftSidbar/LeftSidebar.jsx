
import React, { useContext, useEffect, useMemo, useState } from 'react'
import './LeftSidebar.css'
import assets from '../../assets/assets'
import { auth, db, logout } from '../../config/firebase'
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore'
import { AppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'

const LeftSidebar = ({ onUserSelect }) => {
    const [users, setUsers] = useState([])
    const [contacts, setContacts] = useState([])
    const [requests, setRequests] = useState([])
    const [search, setSearch] = useState('')
    const [lastMessages, setLastMessages] = useState({})
    const [unreadCounts, setUnreadCounts] = useState({})
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState('')
    const [activeTab, setActiveTab] = useState('chats')
    const [busyUserId, setBusyUserId] = useState(null)

    const { selectedUser, setSelectedUser } = useContext(AppContext)
    const navigate = useNavigate()
    const currentUserId = auth.currentUser?.uid

    // Load profiles for the search screen. Contacts are loaded separately.
    useEffect(() => {
        let mounted = true

        const loadUsers = async () => {
            try {
                setLoading(true)
                setFetchError('')

                if (!auth.currentUser) {
                    setUsers([])
                    setFetchError('Please log in first.')
                    return
                }

                const snapshot = await getDocs(collection(db, 'users'))
                const list = snapshot.docs
                    .map(item => ({ ...item.data(), id: item.id }))
                    .filter(item => item.id !== auth.currentUser.uid)

                if (mounted) setUsers(list)
            } catch (error) {
                console.error('Loading users failed:', error)
                if (mounted) {
                    setFetchError(
                        'Could not load users. Check Firestore Rules and try again.'
                    )
                }
            } finally {
                if (mounted) setLoading(false)
            }
        }

        loadUsers()
        return () => { mounted = false }
    }, [])

    // Listen to accepted contacts belonging to the signed-in user.
    useEffect(() => {
        if (!currentUserId) {
            setContacts([])
            return
        }

        const contactsQuery = query(
            collection(db, 'contacts'),
            where('users', 'array-contains', currentUserId)
        )

        return onSnapshot(contactsQuery, snapshot => {
            const otherIds = snapshot.docs
                .map(item => item.data().users?.find(id => id !== currentUserId))
                .filter(Boolean)

            setContacts(users.filter(user => otherIds.includes(user.id)))
        }, error => {
            console.error('Loading contacts failed:', error)
            setFetchError('Could not load contacts. Check Firestore Rules.')
        })
    }, [currentUserId, users])

    // Listen to incoming friend requests.
    useEffect(() => {
        if (!currentUserId) {
            setRequests([])
            return
        }

        const incomingQuery = query(
            collection(db, 'friendRequests'),
            where('receiverId', '==', currentUserId),
            where('status', '==', 'pending')
        )

        return onSnapshot(incomingQuery, snapshot => {
            setRequests(snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            })))
        }, error => {
            console.error('Loading requests failed:', error)
        })
    }, [currentUserId])

    // Keep latest-message previews and unread counts for accepted contacts only.
    useEffect(() => {
        if (!currentUserId || contacts.length === 0) {
            setLastMessages({})
            setUnreadCounts({})
            return
        }

        const unsubscribers = []

        contacts.forEach(user => {
            const chatId = [currentUserId, user.id].sort().join('_')
            const messagesQuery = query(
                collection(db, 'chats', chatId, 'messages'),
                orderBy('createdAt', 'desc')
            )

            const unsubscribe = onSnapshot(messagesQuery, snapshot => {
                const messages = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }))

                setLastMessages(previous => ({
                    ...previous,
                    [user.id]: messages[0] || null
                }))

                setUnreadCounts(previous => ({
                    ...previous,
                    [user.id]: messages.filter(message =>
                        message.receiverId === currentUserId &&
                        message.read === false
                    ).length
                }))
            }, error => {
                console.error(`Loading chat for ${user.id} failed:`, error)
            })

            unsubscribers.push(unsubscribe)
        })

        return () => unsubscribers.forEach(unsubscribe => unsubscribe())
    }, [currentUserId, contacts])

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return []

        return users.filter(user =>
            user.username?.toLowerCase().includes(term) ||
            user.name?.toLowerCase().includes(term)
        )
    }, [users, search])

    const contactIds = useMemo(
        () => new Set(contacts.map(user => user.id)),
        [contacts]
    )

    const requestByUserId = useMemo(() => {
        const map = new Map()
        requests.forEach(request => map.set(request.senderId, request))
        return map
    }, [requests])

    // Use one request document per pair; rejected requests can be sent again.
    const makeRequestId = (firstId, secondId) =>
        [firstId, secondId].sort().join('_')

    const sendRequest = async user => {
        if (!currentUserId || !user?.id || busyUserId) return

        if (currentUserId === user.id) {
            alert('You cannot send a friend request to yourself.')
            return
        }

        const requestId = makeRequestId(currentUserId, user.id)
        const requestRef = doc(db, 'friendRequests', requestId)
        const contactRef = doc(db, 'contacts', requestId)

        setBusyUserId(user.id)

        try {
            await runTransaction(db, async transaction => {
                const requestSnapshot = await transaction.get(requestRef)
                const contactSnapshot = await transaction.get(contactRef)

                if (contactSnapshot.exists()) {
                    throw new Error('ALREADY_CONTACTS')
                }

                const requestData = {
                    senderId: currentUserId,
                    receiverId: user.id,
                    status: 'pending',
                    createdAt: serverTimestamp()
                }

                if (!requestSnapshot.exists()) {
                    transaction.set(requestRef, requestData)
                    return
                }

                const existingRequest = requestSnapshot.data()

                if (existingRequest.status === 'pending') {
                    if (existingRequest.senderId === currentUserId) {
                        throw new Error('REQUEST_ALREADY_SENT')
                    }
                    throw new Error('REQUEST_RECEIVED')
                }

                if (existingRequest.status === 'accepted') {
                    throw new Error('ALREADY_CONTACTS')
                }

                if (existingRequest.status === 'rejected') {
                    // Start a fresh pending request after a previous rejection.
                    transaction.update(requestRef, requestData)
                    return
                }

                throw new Error('REQUEST_ALREADY_EXISTS')
            })

            alert('Friend request sent.')
        } catch (error) {
            console.error('Sending request failed:', error)

            if (error.message === 'ALREADY_CONTACTS') {
                alert('You are already connected with this user.')
            } else if (error.message === 'REQUEST_ALREADY_SENT') {
                alert('Friend request already sent.')
            } else if (error.message === 'REQUEST_RECEIVED') {
                alert('This user has already sent you a request. Open the Requests tab to accept it.')
            } else if (error.message === 'REQUEST_ALREADY_EXISTS') {
                alert('A previous request exists. Please try again or check the Requests tab.')
            } else {
                alert('Could not send request. Check Firestore Rules and try again.')
            }
        } finally {
            setBusyUserId(null)
        }
    }

    // Update the request first, then create the contact.
    // Firestore Rules cannot see another write in the same batch through get().
    const acceptRequest = async request => {
        if (!currentUserId || request.receiverId !== currentUserId || busyUserId) return

        setBusyUserId(request.senderId)

        const requestRef = doc(db, 'friendRequests', request.id)
        const contactId = makeRequestId(request.senderId, request.receiverId)
        const contactRef = doc(db, 'contacts', contactId)

        try {
            await updateDoc(requestRef, { status: 'accepted' })

            await setDoc(contactRef, {
                users: [request.senderId, request.receiverId].sort(),
                createdAt: serverTimestamp()
            })

        } catch (error) {
            console.error('Accepting request failed:', error)
            alert(
                'Could not finish accepting this request. If it now shows as accepted but no chat appears, try again or check Firestore Rules.'
            )
        } finally {
            setBusyUserId(null)
        }
    }

    const rejectRequest = async request => {
        if (!currentUserId || request.receiverId !== currentUserId || busyUserId) return

        setBusyUserId(request.senderId)

        try {
            // Keep the request record so either user can send a new request later.
            await updateDoc(doc(db, 'friendRequests', request.id), {
                status: 'rejected'
            })
        } catch (error) {
            console.error('Rejecting request failed:', error)
            alert('Could not reject request. Check Firestore Rules.')
        } finally {
            setBusyUserId(null)
        }
    }

    const formatTime = timestamp => {
        if (!timestamp?.toDate) return ''
        return timestamp.toDate().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getMessagePreview = message => {
        if (!message) return 'Start a conversation'
        if (message.image) return '📷 Image'
        return message.text || ''
    }

    const handleUserClick = user => {
        setSelectedUser(user)
        onUserSelect?.()
    }

    const handleEditProfile = () => navigate('/profile')

    const handleLogout = async () => {
        try {
            await logout()
            setSelectedUser(null)
            navigate('/')
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    const renderContact = user => {
        const lastMessage = lastMessages[user.id]
        const unreadCount = unreadCounts[user.id] || 0

        return (
            <div
                key={user.id}
                className={`friends ${selectedUser?.id === user.id ? 'selected' : ''}`}
                onClick={() => handleUserClick(user)}
            >
                <img src={user.avatar || assets.profile_img} alt="User avatar" />
                <div className="friend-info">
                    <div className="friend-name-row">
                        <p>{user.name || user.username || 'User'}</p>
                        {lastMessage && (
                            <span className="last-time">
                                {formatTime(lastMessage.createdAt)}
                            </span>
                        )}
                    </div>
                    <div className="friend-bottom">
                        <span className="last-message">
                            {getMessagePreview(lastMessage)}
                        </span>
                        {unreadCount > 0 && (
                            <span className="unread-count">{unreadCount}</span>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="ls">
            <div className="ls-top">
                <div className="ls-nav">
                    <img src={assets.logo} className="logo" alt="Chatapp" />
                    <div className="menu">
                        <img src={assets.menu_icon} alt="Menu" />
                        <div className="sub-menu">
                            <p onClick={handleEditProfile}>Edit Profile</p>
                            <hr />
                            <p onClick={handleLogout}>Logout</p>
                        </div>
                    </div>
                </div>

                <div className="ls-search">
                    <img src={assets.search_icon} alt="Search" />
                    <input
                        type="text"
                        placeholder="Search username or name..."
                        value={search}
                        onChange={event => {
                            setSearch(event.target.value)
                            setActiveTab('search')
                        }}
                    />
                </div>

                <div className="ls-tabs">
                    <button
                        type="button"
                        className={activeTab === 'chats' ? 'active' : ''}
                        onClick={() => setActiveTab('chats')}
                    >
                        Chats
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'requests' ? 'active' : ''}
                        onClick={() => setActiveTab('requests')}
                    >
                        Requests {requests.length > 0 && `(${requests.length})`}
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'search' ? 'active' : ''}
                        onClick={() => setActiveTab('search')}
                    >
                        Find users
                    </button>
                </div>
            </div>

            <div className="ls-list">
                {loading ? (
                    <p className="ls-message">Loading...</p>
                ) : fetchError ? (
                    <p className="ls-message">{fetchError}</p>
                ) : activeTab === 'chats' ? (
                    contacts.length === 0 ? (
                        <p className="ls-message">No contacts yet. Find a user and send a request.</p>
                    ) : contacts.map(renderContact)
                ) : activeTab === 'requests' ? (
                    requests.length === 0 ? (
                        <p className="ls-message">No pending friend requests.</p>
                    ) : requests.map(request => {
                        const sender = users.find(user => user.id === request.senderId)
                        return (
                            <div className="friends" key={request.id}>
                                <img src={sender?.avatar || assets.profile_img} alt="Sender avatar" />
                                <div className="friend-info">
                                    <div className="friend-name-row">
                                        <p>{sender?.name || sender?.username || 'User'}</p>
                                    </div>
                                    <div className="friend-bottom">
                                        <button
                                            type="button"
                                            disabled={busyUserId === request.senderId}
                                            onClick={() => acceptRequest(request)}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyUserId === request.senderId}
                                            onClick={() => rejectRequest(request)}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : search.trim() === '' ? (
                    <p className="ls-message">Search by username or name.</p>
                ) : filteredUsers.length === 0 ? (
                    <p className="ls-message">No users found.</p>
                ) : filteredUsers.map(user => {
                    const isContact = contactIds.has(user.id)
                    const incoming = requestByUserId.get(user.id)

                    return (
                        <div className="friends" key={user.id}>
                            <img src={user.avatar || assets.profile_img} alt="User avatar" />
                            <div className="friend-info">
                                <div className="friend-name-row">
                                    <p>{user.name || user.username || 'User'}</p>
                                </div>
                                <div className="friend-bottom">
                                    <span className="last-message">
                                        @{user.username || 'user'}
                                    </span>
                                    {isContact ? (
                                        <span>Contact</span>
                                    ) : incoming ? (
                                        <span>Request received</span>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={busyUserId === user.id}
                                            onClick={() => sendRequest(user)}
                                        >
                                            {busyUserId === user.id ? 'Sending...' : 'Add friend'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default LeftSidebar
