import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET;

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    let { email, firstName, lastName, password } = req.body;

    email = email?.toLowerCase().trim();

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      firstName,
      lastName,
      password: hashedPassword
    });

    res.json({ message: "User created" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.toLowerCase().trim();

    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, {
      expiresIn: "7d"
    });

    res.json({ token });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;