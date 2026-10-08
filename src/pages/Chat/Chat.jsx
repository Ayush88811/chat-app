import React, { useContext } from 'react'
import './Chat.css'
import LeftSidebar from '../../components/LeftSidbar/LeftSidebar'
import ChatBox from '../../components/ChatBox/ChatBox'
import RightSidebar from '../../components/RightSidebar/RightSidebar'
import { AppContext } from '../../context/AppContext'

const Chat = () => {

  const { selectedUser } = useContext(AppContext);

  return (
    <div className='chat'>

      <div className="chat-container">

        {/* Desktop */}
        <div className="desktop-sidebar">
          <LeftSidebar />
        </div>

        <div className="desktop-chat">
          <ChatBox />
        </div>

        <div className="desktop-right">
          <RightSidebar />
        </div>


        {/* Mobile */}
        <div className="mobile-chat">

          {!selectedUser ? (
            <LeftSidebar />
          ) : (
            <ChatBox />
          )}

        </div>

      </div>

    </div>
  )
}

export default Chat