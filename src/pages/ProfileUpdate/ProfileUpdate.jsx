import React, { useState } from 'react'
import './ProfileUpdate.css'
import assets from '../../assets/assets'
import uploadImage from "../../lib/upload";
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const ProfileUpdate = () => {

  const [image, setImage] = useState(false);
  const [name , setName] = useState("");
  const [bio, setBio] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try{
      let imageUrl = "";

      // upload image to cloudinary
      if(image){
        imageUrl = await uploadImage(image);
    }

    // Save data to firebase
    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        name: name,
        bio: bio,
        avatar: imageUrl
      },
      { merge: true }
    );
      console.log("Profile updated successfully");
    } catch(error){
      console.error(error);
    }
  };

  return (
    <div className='profile'>
       <div className="profile-container">
        <form onSubmit={handleSubmit}>
          <h3>Profile Details</h3>
          <label htmlFor="avatar">
            <input onChange={(e)=>setImage(e.target.files[0])} type="file" id="avatar" accept='.png, .jpg, .jpeg' hidden />
            <img src={image? URL.createObjectURL(image) : assets.avatar_icon} alt="" />
            upload profile image
          </label>
          <input type="text" placeholder='Your name' value={name} onChange={(e)=> setName(e.target.value)} required />
          <textarea placeholder='Write profile bio' value={bio} onChange={(e)=> setBio(e.target.value)} required></textarea>
          <button type='submit'>Save</button>
        </form>
        <img className='profile-pic' src={image? URL.createObjectURL(image) : assets.logo_icon} alt="" />
       </div>
    </div>
  )
}

export default ProfileUpdate
