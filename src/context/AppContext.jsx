import { doc, getDoc, updateDoc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const navigate = useNavigate();

    const [userData, setUserData] = useState(null);
    const [chatData, setChatData] = useState(null);

    // Currently selected user
    const [selectedUser, setSelectedUser] = useState(null);


    // Get logged in user's data
    const loadUserData = async (uid) => {

        try {

            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {

                const data = userSnap.data();

                setUserData(data);

                // Go to chat if profile is complete
                if (data.avatar && data.name) {
                    navigate("/chat");
                }
                else {
                    navigate("/profile");
                }

                // Update last seen
                await updateDoc(userRef, {
                    lastSeen: Date.now()
                });
            }

        } catch (error) {

            console.error("Error loading user data:", error);

        }
    };


    // Update last seen every 1 minute
    useEffect(() => {

        if (!auth.currentUser) return;

        const userRef = doc(db, "users", auth.currentUser.uid);

        const interval = setInterval(async () => {

            if (auth.currentUser) {

                try {

                    await updateDoc(userRef, {
                        lastSeen: Date.now()
                    });

                } catch (error) {

                    console.error("Error updating last seen:", error);

                }
            }

        }, 60000);

        // Clear interval when component unmounts
        return () => clearInterval(interval);

    }, [userData]);


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