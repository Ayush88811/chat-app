import { doc, getDoc, updateDoc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const navigate = useNavigate();

    const [userData, setUserData] = useState(null);
    const [chatData, setChatData] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);


    // Get logged-in user's data
    const loadUserData = async (uid) => {

        try {

            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {

                const data = userSnap.data();
                const currentTime = Date.now();

                setUserData({
                    ...data,
                    lastSeen: currentTime
                });

                // Update last seen when user opens the app
                await updateDoc(userRef, {
                    lastSeen: currentTime
                });

                // Open chat only when profile is complete
                if (data.avatar && data.name) {
                    navigate("/chat");
                } else {
                    navigate("/profile");
                }

            }

        } catch (error) {

            console.error("Error loading user data:", error);

        }
    };


    // Keep lastSeen updated while the user is logged in
    useEffect(() => {

        if (!userData?.id || !auth.currentUser) {
            return;
        }

        const userRef = doc(db, "users", userData.id);

        const updateLastSeen = async () => {

            try {

                await updateDoc(userRef, {
                    lastSeen: Date.now()
                });

            } catch (error) {

                console.error("Error updating last seen:", error);

            }
        };

        // Update immediately, then every minute
        updateLastSeen();

        const interval = setInterval(() => {
            updateLastSeen();
        }, 60000);

        return () => clearInterval(interval);

    }, [userData?.id]);


    const value = {
        userData,
        setUserData,

        chatData,
        setChatData,

        selectedUser,
        setSelectedUser,

        loadUserData
    };

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};

export default AppContextProvider;