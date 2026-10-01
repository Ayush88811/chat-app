import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { toast } from "react-toastify";

const firebaseConfig = {
  apiKey: "AIzaSyC7vvTqG8v1_h5zWNwYs4b762UfNF__Wlo",
  authDomain: "chat-app-gs-e58d3.firebaseapp.com",
  projectId: "chat-app-gs-e58d3",
  storageBucket: "chat-app-gs-e58d3.firebasestorage.app",
  messagingSenderId: "159067284509",
  appId: "1:159067284509:web:95d99b0c7f6173bfa412f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const signup = async (username, email, password) => {
    try{
        const res = await createUserWithEmailAndPassword(auth,email,password);
        const user = res.user;
        await setDoc(doc(db,"users",user.uid),{
            id:user.uid,
            username:username.toLowerCase(),
            email,
            name:"",
            avatar:"",
            bio:"Hey, There i am using chat app",
            lastSeen:Date.now()
        })
        await setDoc(doc(db,"chats",user.uid),{
            chatData:[]
        })
    } catch(error){
        console.error(error)
        toast.error(error.code.split('/')[1].split('-').join(" "));
    }
}

const login = async (email, password) => {
    try{
        await signInWithEmailAndPassword(auth,email,password)

    } catch(error){
        console.error(error)
        toast.error(error.code.split('/')[1].split('-').join(" "));

    }

}

const logout = async () => {
    try{
        await signOut(auth)
    } catch(error){
        console.error(error);
        toast.error(error.code.split('/')[1].split('-').join(" "));

    }
}

export {signup,login,logout,auth,db}