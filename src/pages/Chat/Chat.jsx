
import React, { useContext, useState } from 'react'
import './Chat.css'

import LeftSidebar from '../../components/LeftSidbar/LeftSidebar'
import ChatBox from '../../components/ChatBox/ChatBox'
import RightSidebar from '../../components/RightSidebar/RightSidebar'

import { AppContext } from '../../context/AppContext'

const Chat = () => {
    const { selectedUser } = useContext(AppContext)

    const [isProfileOpen, setIsProfileOpen] = useState(false)

    const openProfile = () => setIsProfileOpen(true)
    const closeProfile = () => setIsProfileOpen(false)

    return (
        <div className="chat">
            <div className="chat-container">

                {/* Keep the contact list visible on desktop. */}
                <div className="desktop-sidebar">
                    <LeftSidebar />
                </div>

                {/* Show the welcome screen until a contact is selected. */}
                <div className="desktop-chat">
                    {selectedUser ? (
                        <ChatBox onInfoClick={openProfile} />
                    ) : (
                        
<div className="welcome-screen">
    <div className="welcome-content">
        <div className="welcome-icon">
            <span>•••</span>
        </div>

        <p className="welcome-tagline">YOUR SPACE TO CONNECT</p>

        <h2>
            Conversations that
            <span> bring us closer.</span>
        </h2>

        <p className="welcome-description">
            Select a contact from your chats and pick up
            where your conversation left off.
        </p>

        <div className="welcome-hint">
            <span className="welcome-hint-dot"></span>
            Your conversations start here
        </div>
    </div>
</div>

                    )}
                </div>

               {selectedUser && (
    <div className="desktop-right">
        <RightSidebar />
    </div>
)}

                {/* On mobile, show either contacts or the selected chat. */}
                <div className="mobile-chat">
                    {!selectedUser ? (
                        <LeftSidebar />
                    ) : (
                        <>
                            <ChatBox onInfoClick={openProfile} />

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
