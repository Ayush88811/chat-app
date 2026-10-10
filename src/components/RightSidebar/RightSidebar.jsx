import React, { useContext, useEffect, useState } from 'react'
import './RightSidebar.css'
import assets from '../../assets/assets'
import { logout, db } from '../../config/firebase'
import { AppContext } from '../../context/AppContext'
import { doc, onSnapshot } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

const RightSidebar = ({ isMobileOpen = false, onClose }) => {

    const { selectedUser } = useContext(AppContext)

    const [profileData, setProfileData] = useState(null)

    const navigate = useNavigate()


    // Listen for the selected user's latest profile
    useEffect(() => {

        if (!selectedUser?.id) {
            setProfileData(null)
            return
        }

        const userRef = doc(
            db,
            'users',
            selectedUser.id
        )

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


            {/* Media section */}
            <div className="rs-media">

                <p>Media</p>

                <div>
                    <img src={assets.pic1} alt="Media 1" />
                    <img src={assets.pic2} alt="Media 2" />
                    <img src={assets.pic3} alt="Media 3" />
                    <img src={assets.pic4} alt="Media 4" />
                    <img src={assets.pic1} alt="Media 5" />
                    <img src={assets.pic2} alt="Media 6" />
                </div>

            </div>


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

