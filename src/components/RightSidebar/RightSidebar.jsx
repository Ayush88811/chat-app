
import React, { useContext, useEffect, useState } from 'react'
import './RightSidebar.css'
import assets from '../../assets/assets'
import { logout, db, auth } from '../../config/firebase'
import { AppContext } from '../../context/AppContext'
import {
    collection,
    doc,
    onSnapshot
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

const RightSidebar = ({ isMobileOpen = false, onClose }) => {

    const { selectedUser } = useContext(AppContext)

    const [profileData, setProfileData] = useState(null)
    const [mediaImages, setMediaImages] = useState([])
    const [previewImage, setPreviewImage] = useState(null)

    const navigate = useNavigate()

    // Listen for the selected user's latest profile
    useEffect(() => {

        if (!selectedUser?.id) {
            setProfileData(null)
            return
        }

        const userRef = doc(db, 'users', selectedUser.id)

        const unsubscribe = onSnapshot(
            userRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setProfileData(snapshot.data())
                } else {
                    setProfileData(null)
                }
            },
            (error) => {
                console.error('Error loading profile:', error)
            }
        )

        return () => unsubscribe()

    }, [selectedUser?.id])


    // Load images from the currently selected chat
    useEffect(() => {

        const currentUserId = auth.currentUser?.uid
        const selectedUserId = selectedUser?.id

        setMediaImages([])
        setPreviewImage(null)

        if (!currentUserId || !selectedUserId) {
            return
        }

        // Use the same chat ID format as ChatBox
        const chatId = [currentUserId, selectedUserId]
            .sort()
            .join('_')

        const messagesRef = collection(
            db,
            'chats',
            chatId,
            'messages'
        )

        const unsubscribe = onSnapshot(
            messagesRef,
            (snapshot) => {

                // Keep only messages that contain an image
                const images = snapshot.docs
                    .map((messageDoc) => ({
                        id: messageDoc.id,
                        ...messageDoc.data()
                    }))
                    .filter((message) => message.image)
                    .sort((a, b) => {
                        const timeA = a.createdAt?.toMillis?.() || 0
                        const timeB = b.createdAt?.toMillis?.() || 0
                        return timeB - timeA
                    })

                setMediaImages(images)
            },
            (error) => {
                console.error('Error loading chat media:', error)
                setMediaImages([])
            }
        )

        return () => unsubscribe()

    }, [selectedUser?.id])


    // Close image preview using the Escape key
    useEffect(() => {

        if (!previewImage) return

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setPreviewImage(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }

    }, [previewImage])


    // Logout current user
    const handleLogout = async () => {

        try {
            await logout()
            onClose?.()
            navigate('/')
        } catch (error) {
            console.error('Logout error:', error)
        }

    }


    return (
        <div
            className={`rs ${isMobileOpen ? 'rs-mobile-open' : ''}`}
        >

            {/* Close profile on mobile */}
            <button
                type="button"
                className="rs-close"
                onClick={onClose}
                aria-label="Close profile"
            >
                ×
            </button>


            {/* Selected user's profile */}
            <div className="rs-profile">

                <img
                    src={
                        profileData?.avatar ||
                        selectedUser?.avatar ||
                        assets.profile_img
                    }
                    alt="Profile"
                />

                <h3>
                    {
                        profileData?.name ||
                        selectedUser?.name ||
                        selectedUser?.username ||
                        'User'
                    }
                </h3>

                <p>
                    {profileData?.bio || 'No bio available'}
                </p>

            </div>


            <hr />


            {/* Images shared in this chat */}
            <div className="rs-media">

                <p>Media</p>

                <div className="rs-media-grid">

                    {mediaImages.length > 0 ? (

                        mediaImages.map((message) => (

                            <button
                                type="button"
                                className="rs-media-item"
                                key={message.id}
                                onClick={() => {
                                    setPreviewImage(message.image)
                                }}
                                aria-label="Preview shared image"
                            >
                                <img
                                    src={message.image}
                                    alt="Shared in chat"
                                    loading="lazy"
                                />
                            </button>

                        ))

                    ) : (

                        <p className="rs-no-media">
                            No shared images yet
                        </p>

                    )}

                </div>

            </div>


            {/* Full-size image preview */}
            {previewImage && (

                <div
                    className="rs-image-preview"
                    onClick={() => setPreviewImage(null)}
                    role="presentation"
                >

                    <button
                        type="button"
                        className="rs-preview-close"
                        onClick={() => setPreviewImage(null)}
                        aria-label="Close image preview"
                    >
                        ×
                    </button>

                    <img
                        src={previewImage}
                        alt="Full-size shared image"
                        onClick={(event) => event.stopPropagation()}
                    />

                </div>

            )}


            {/* Logout */}
            <button
                type="button"
                className="rs-logout"
                onClick={handleLogout}
            >
                Logout
            </button>

        </div>
    )

}

export default RightSidebar
