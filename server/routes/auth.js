import Router from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  tokenId: z.string().min(1, 'Google token is required'),
});

router.post('/signup', async (req, res) => {
  try {
    const validated = signupSchema.parse(req.body);

    const existing = await User.findOne({ email: validated.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(validated.password, 10);

    const user = new User({
      email: validated.email.toLowerCase(),
      password: hashedPassword,
      name: validated.name || validated.email.split('@')[0],
    });
    await user.save();

    const subscription = new Subscription({
      userId: user._id,
      plan: 'free',
      status: 'active',
    });
    await subscription.save();

    const token = generateToken(user._id.toString(), user.email);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'This email is registered via Google Sign-In. Please use Google to login.' });
    }

    const isValid = await bcrypt.compare(validated.password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user._id.toString(), user.email);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const validated = googleAuthSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({
      idToken: validated.tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.name) user.name = payload.name;
        if (!user.avatar) user.avatar = payload.picture;
        await user.save();
      }
    } else {
      user = new User({
        email,
        googleId,
        name: payload.name || email.split('@')[0],
        avatar: payload.picture,
      });
      await user.save();

      const subscription = new Subscription({
        userId: user._id,
        plan: 'free',
        status: 'active',
      });
      await subscription.save();
    }

    const token = generateToken(user._id.toString(), user.email);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticateToken, (_req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
