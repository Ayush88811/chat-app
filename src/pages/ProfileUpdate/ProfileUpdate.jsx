
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
    const navigate = useNavigate()
    const { setUserData } = useContext(AppContext)

    const [image, setImage] = useState(null)
    const [imageUrl, setImageUrl] = useState('')
    const [name, setName] = useState('')
    const [bio, setBio] = useState('')
    const [loading, setLoading] = useState(false)

    // Load the existing profile
    useEffect(() => {
        let cancelled = false

        const loadProfile = async () => {
            if (!auth.currentUser) {
                return
            }

            try {
                const userRef = doc(
                    db,
                    'users',
                    auth.currentUser.uid
                )

                const userSnap = await getDoc(userRef)

                if (cancelled) return

                if (userSnap.exists()) {
                    const data = userSnap.data()

                    setName(data.name || '')
                    setBio(data.bio || '')
                    setImageUrl(data.avatar || '')
                }
            } catch (error) {
                console.error('Error loading profile:', error)
                toast.error('Unable to load profile')
            }
        }

        loadProfile()

        return () => {
            cancelled = true
        }
    }, [])

    // Handle choosing a profile image
    const handleImageChange = (e) => {
        const file = e.target.files?.[0]

        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file')
            e.target.value = ''
            return
        }

        setImage(file)
        e.target.value = ''
    }

    // Save profile details
    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!auth.currentUser) {
            toast.error('Please login first')
            return
        }

        if (!name.trim()) {
            toast.error('Please enter your name')
            return
        }

        if (!bio.trim()) {
            toast.error('Please enter your bio')
            return
        }

        try {
            setLoading(true)

            let finalImageUrl = imageUrl

            // Upload a new image only when one is selected
            if (image) {
                finalImageUrl = await uploadImage(image)
            }

            const updatedData = {
                name: name.trim(),
                bio: bio.trim(),
                avatar: finalImageUrl
            }

            // Update the user's Firestore document
            await setDoc(
                doc(db, 'users', auth.currentUser.uid),
                updatedData,
                { merge: true }
            )

            // Update app state immediately
            setUserData((prev) => ({
                ...prev,
                ...updatedData
            }))

            toast.success('Profile updated successfully')
            navigate('/chat')
        } catch (error) {
            console.error('Error updating profile:', error)
            toast.error('Failed to update profile')
        } finally {
            setLoading(false)
        }
    }

    // Show the selected image before uploading
    const previewImage = image
        ? URL.createObjectURL(image)
        : imageUrl || assets.avatar_icon

    return (
        <div className="profile">
            <div className="profile-container">
                <form onSubmit={handleSubmit}>
                    <h3>Profile Details</h3>

                    {/* Profile image upload */}
                    <label htmlFor="avatar">
                        <input
                            type="file"
                            id="avatar"
                            accept="image/png, image/jpeg"
                            hidden
                            onChange={handleImageChange}
                        />

                        <img
                            src={previewImage}
                            alt="Profile"
                        />

                        <span>
                            {image
                                ? 'Change profile image'
                                : 'Upload profile image'}
                        </span>
                    </label>

                    {/* Name */}
                    <input
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    {/* Bio */}
                    <textarea
                        placeholder="Write profile bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        required
                    />

                    {/* Save changes */}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </form>

                {/* Larger preview shown on desktop only */}
                <img
                    className="profile-pic"
                    src={previewImage || assets.logo_icon}
                    alt="Profile preview"
                />
            </div>
        </div>
    )
}

export default ProfileUpdate