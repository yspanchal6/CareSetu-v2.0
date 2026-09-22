import { Patient } from "../types";

export const patients: Patient[] = [
  { id: "P001", name: "Rohan Mehta", age: 34, gender: "Male", bloodGroup: "O+", allergies: ["Penicillin"], medications: ["Metformin"], conditions: ["Type 2 Diabetes"], emergencyContacts: [{ name: "Anita Mehta", phone: "+91 98250 11223", relation: "Spouse" }] },
  { id: "P002", name: "Priya Sharma", age: 27, gender: "Female", bloodGroup: "A+", allergies: [], medications: [], conditions: [], emergencyContacts: [{ name: "Raj Sharma", phone: "+91 98250 22334", relation: "Father" }] },
  { id: "P003", name: "Amit Patel", age: 58, gender: "Male", bloodGroup: "B+", allergies: ["Sulfa drugs"], medications: ["Atorvastatin", "Aspirin"], conditions: ["Hypertension", "Coronary Artery Disease"], emergencyContacts: [{ name: "Neha Patel", phone: "+91 98250 33445", relation: "Daughter" }] },
  { id: "P004", name: "Sneha Joshi", age: 41, gender: "Female", bloodGroup: "AB+", allergies: ["Latex"], medications: [], conditions: ["Asthma"], emergencyContacts: [{ name: "Vikram Joshi", phone: "+91 98250 44556", relation: "Spouse" }] },
  { id: "P005", name: "Karan Shah", age: 19, gender: "Male", bloodGroup: "O-", allergies: [], medications: [], conditions: [], emergencyContacts: [{ name: "Meena Shah", phone: "+91 98250 55667", relation: "Mother" }] },
  { id: "P006", name: "Divya Nair", age: 63, gender: "Female", bloodGroup: "B-", allergies: ["Iodine"], medications: ["Insulin", "Losartan"], conditions: ["Diabetes", "Chronic Kidney Disease"], emergencyContacts: [{ name: "Suresh Nair", phone: "+91 98250 66778", relation: "Son" }] },
  { id: "P007", name: "Arjun Reddy", age: 45, gender: "Male", bloodGroup: "A-", allergies: [], medications: ["Metoprolol"], conditions: ["Arrhythmia"], emergencyContacts: [{ name: "Lakshmi Reddy", phone: "+91 98250 77889", relation: "Spouse" }] },
  { id: "P008", name: "Ishita Kapoor", age: 30, gender: "Female", bloodGroup: "O+", allergies: ["Peanuts"], medications: [], conditions: [], emergencyContacts: [{ name: "Manish Kapoor", phone: "+91 98250 88990", relation: "Spouse" }] },
  { id: "P009", name: "Manoj Verma", age: 52, gender: "Male", bloodGroup: "AB-", allergies: [], medications: ["Amlodipine"], conditions: ["Hypertension"], emergencyContacts: [{ name: "Kavita Verma", phone: "+91 98250 99001", relation: "Spouse" }] },
  { id: "P010", name: "Ritu Desai", age: 24, gender: "Female", bloodGroup: "A+", allergies: [], medications: [], conditions: [], emergencyContacts: [{ name: "Nikhil Desai", phone: "+91 98250 10112", relation: "Brother" }] },
];
