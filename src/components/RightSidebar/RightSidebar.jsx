import React, { useContext } from 'react'
import './RightSidebar.css';
import assets from '../../assets/assets';
import { logout } from '../../config/firebase';
import { AppContext } from '../../context/AppContext';

const RightSidebar = () => {

  const { userData } = useContext(AppContext);

  return (
    <div className='rs'>

      <div className='rs-profile'>

        <img
          src={userData?.avatar || assets.profile_img}
          alt=""
        />

        <h3>
          {userData?.name}
          <img
            src={assets.green_dot}
            className='dot'
            alt=''
          />
        </h3>

        <p>
          {userData?.bio}
        </p>

      </div>

      <hr />

      <div className='rs-media'>
        <p>Media</p>

        <div>
          <img src={assets.pic1} alt="" />
          <img src={assets.pic2} alt="" />
          <img src={assets.pic3} alt="" />
          <img src={assets.pic4} alt="" />
          <img src={assets.pic1} alt="" />
          <img src={assets.pic2} alt="" />
        </div>
      </div>

      <button onClick={() => logout()}>
        Logout
      </button>

    </div>
  )
}

export default RightSidebar