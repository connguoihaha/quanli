import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

// Firebase config của bạn
const firebaseConfig = {
  apiKey: "AIzaSyAsgPPLpDppirUHXkAvozAaZVPDbFtbJYA",
  authDomain: "managecccd.firebaseapp.com",
  projectId: "managecccd",
  storageBucket: "managecccd.firebasestorage.app",
  messagingSenderId: "728638757442",
  appId: "1:728638757442:web:7ee1eb3783e913875a2bdb"
};

// Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mock data
const names = [
  "Nguyễn Văn A",
  "Trần Thị B",
  "Lê Văn C",
  "Phạm Thị D",
  "Hoàng Văn E",
  "Võ Minh Tú"
];

function randomCCCD(i) {
  return (100000000000 + Date.now() + i).toString().slice(0, 12);
}

const TOTAL = 200;

console.time("seed");

for (let i = 0; i < TOTAL; i++) {
  await addDoc(collection(db, "customers"), {
    name: names[Math.floor(Math.random() * names.length)],
    cccd: randomCCCD(i),
    isMock: true,
    createdAt: serverTimestamp()
  });

  console.log(`✅ ${i + 1}/${TOTAL}`);
}

console.timeEnd("seed");
console.log("🎉 Seed data thành công");
process.exit();
