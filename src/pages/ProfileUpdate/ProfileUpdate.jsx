import React, { useContext, useEffect, useState } from 'react'
import './ProfileUpdate.css'
import assets from '../../assets/assets'
import uploadImage from '../../lib/upload'
import { auth, db } from '../../config/firebase'

import {
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore'

import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { AppContext } from '../../context/AppContext'


const ProfileUpdate = () => {

  const navigate = useNavigate();

  const { setUserData } = useContext(AppContext);

  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(false);


  // Load existing profile data
  useEffect(() => {

    const loadProfile = async () => {

      if (!auth.currentUser) {
        return;
      }

      try {

        const userRef = doc(
          db,
          "users",
          auth.currentUser.uid
        );

        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {

          const data = userSnap.data();

          setName(data.name || "");
          setBio(data.bio || "");
          setImageUrl(data.avatar || "");

        }

      } catch (error) {

        console.error(
          "Error loading profile:",
          error
        );

        toast.error("Unable to load profile");

      }

    };

    loadProfile();

  }, []);


  // Save profile
  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!auth.currentUser) {
      toast.error("Please login first");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!bio.trim()) {
      toast.error("Please enter your bio");
      return;
    }

    try {

      setLoading(true);

      let finalImageUrl = imageUrl;


      // Upload new image only if selected
      if (image) {

        finalImageUrl = await uploadImage(image);

      }


      const updatedData = {
        name: name.trim(),
        bio: bio.trim(),
        avatar: finalImageUrl
      };


      // Update Firestore
      await setDoc(
        doc(
          db,
          "users",
          auth.currentUser.uid
        ),
        updatedData,
        {
          merge: true
        }
      );


      // Update context immediately
      setUserData((prev) => ({
        ...prev,
        ...updatedData
      }));


      toast.success("Profile updated successfully");


      // Go back to chat
      setTimeout(() => {
        navigate("/chat");
      }, 500);


    } catch (error) {

      console.error(
        "Error updating profile:",
        error
      );

      toast.error("Failed to update profile");

    } finally {

      setLoading(false);

    }

  };


  return (
    <div className='profile'>

      <div className="profile-container">

        <form onSubmit={handleSubmit}>

          <h3>Profile Details</h3>


          {/* Profile image */}

          <label htmlFor="avatar">

            <input
              type="file"
              id="avatar"
              accept=".png, .jpg, .jpeg"
              hidden
              onChange={(e) => {

                const file =
                  e.target.files[0];

                if (file) {
                  setImage(file);
                }

              }}
            />


            <img
              src={
                image
                  ? URL.createObjectURL(image)
                  : (
                    imageUrl ||
                    assets.avatar_icon
                  )
              }
              alt="profile"
            />

            <span>
              {image
                ? "Change profile image"
                : "upload profile image"}
            </span>

          </label>


          {/* Name */}

          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            required
          />


          {/* Bio */}

          <textarea
            placeholder="Write profile bio"
            value={bio}
            onChange={(e) =>
              setBio(e.target.value)
            }
            required
          />


          {/* Save */}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Save"}
          </button>

        </form>


        {/* Profile preview */}

        <img
          className="profile-pic"
          src={
            image
              ? URL.createObjectURL(image)
              : (
                imageUrl ||
                assets.logo_icon
              )
          }
          alt="profile preview"
        />

      </div>

    </div>
  )
}

export default ProfileUpdate