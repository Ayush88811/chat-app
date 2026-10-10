import React, { useContext, useState } from 'react'
import './Chat.css'

import LeftSidebar from '../../components/LeftSidbar/LeftSidebar'
import ChatBox from '../../components/ChatBox/ChatBox'
import RightSidebar from '../../components/RightSidebar/RightSidebar'

import { AppContext } from '../../context/AppContext'

const Chat = () => {
    const { selectedUser } = useContext(AppContext)

    // Controls the mobile profile panel
    const [isProfileOpen, setIsProfileOpen] = useState(false)

    // Open the selected user's profile
    const openProfile = () => {
        setIsProfileOpen(true)
    }

    // Close the profile panel
    const closeProfile = () => {
        setIsProfileOpen(false)
    }

    return (
        <div className="chat">
            <div className="chat-container">

                {/* Desktop layout */}
                <div className="desktop-sidebar">
                    <LeftSidebar />
                </div>

                <div className="desktop-chat">
                    <ChatBox />
                </div>

                <div className="desktop-right">
                    <RightSidebar />
                </div>

                {/* Mobile layout */}
                <div className="mobile-chat">
                    {!selectedUser ? (
                        <LeftSidebar />
                    ) : (
                        <>
                            <ChatBox
                                onInfoClick={openProfile}
                            />

                            {/* Mobile profile overlay */}
                            {isProfileOpen && (
                                <div className="mobile-profile-overlay">
                                    <RightSidebar
                                        isMobileOpen={true}
                                        onClose={closeProfile}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

            </div>
        </div>
    )
}

export default Chat

