import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { auth, db } from '../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { AppContext } from '../../context/AppContext';

const LeftSidebar = () => {

    const [users, setUsers] = useState([]);

    const { setSelectedUser } = useContext(AppContext);

    const fetchUsers = async () => {
        try {
            const userRef = collection(db, "users");

            const snapshot = await getDocs(userRef);

            const usersList = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }))
            .filter((user) => user.id !== auth.currentUser.uid); // Exclude the current user

            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users: ", error);
        }
    };

    useEffect(()=>{
        fetchUsers();
    },[]);  

  return (
    <div className='ls'>
        <div className="ls-top">
            <div className="ls-nav">
                <img src={assets.logo} className='logo' alt="" />
                <div className='menu'>
                    <img src={assets.menu_icon} alt="" />
                    <div className="sub-menu">
                        <p>Edit Profile</p>
                        <hr />
                        <p>Logout</p>
                    </div>
                </div>
            </div>
            <div className='ls-search'>
                <img src={assets.search_icon} alt="" />
                <input type="text" placeholder='Search here..' />
            </div>
        </div>
        <div className="ls-list">
           {users.map((user)=>(
                <div key={user.id} className="friends" onClick={()=> setSelectedUser(user)}>
                <img src={user.avatar ||assets.profile_img} alt="" />
                <div>
                    <p>{user.name || user.username}</p>
                    <span>{user.bio}</span>
                </div>
            </div>
            ))}
        </div>
      
    </div>
  )
}

export default LeftSidebar
