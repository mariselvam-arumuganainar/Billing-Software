import { Response } from 'express';
import { prisma } from 'database';
import { AuthRequest } from '../middleware/auth';

export const getReminders = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { status } = req.query;
    const where: Record<string, unknown> = { tenantId };
    if (status && typeof status === 'string') where.status = status;

    const reminders = await prisma.reminder.findMany({
      where,
      orderBy: { reminderAt: 'asc' },
    });

    return res.status(200).json({ reminders });
  } catch (error) {
    console.error('Get reminders error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDueReminders = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const reminders = await prisma.reminder.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        reminderAt: { lte: now },
      },
      orderBy: { reminderAt: 'asc' },
    });

    return res.status(200).json({ reminders });
  } catch (error) {
    console.error('Get due reminders error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, reminderAt, repeatType, priority } = req.body;
    if (!title || !reminderAt) {
      return res.status(400).json({ error: 'Title and reminderAt are required' });
    }

    const reminder = await prisma.reminder.create({
      data: {
        tenantId,
        title,
        description: description || null,
        reminderAt: new Date(reminderAt),
        repeatType: repeatType || 'NONE',
        priority: priority || 'MEDIUM',
        status: 'PENDING',
      },
    });

    return res.status(201).json({ reminder });
  } catch (error) {
    console.error('Create reminder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateReminder = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const { title, description, reminderAt, repeatType, priority, status } = req.body;

    const existing = await prisma.reminder.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(reminderAt && { reminderAt: new Date(reminderAt) }),
        ...(repeatType && { repeatType }),
        ...(priority && { priority }),
        ...(status && { status }),
      },
    });

    return res.status(200).json({ reminder });
  } catch (error) {
    console.error('Update reminder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const markDone = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.reminder.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    const reminder = await prisma.reminder.update({
      where: { id },
      data: { status: 'DONE', completedAt: new Date() },
    });

    return res.status(200).json({ reminder });
  } catch (error) {
    console.error('Mark done error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const snoozeReminder = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const { minutes = 15 } = req.body;

    const existing = await prisma.reminder.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    const snoozedUntil = new Date(Date.now() + Number(minutes) * 60 * 1000);

    const reminder = await prisma.reminder.update({
      where: { id },
      data: { status: 'PENDING', snoozedUntil, reminderAt: snoozedUntil },
    });

    return res.status(200).json({ reminder });
  } catch (error) {
    console.error('Snooze reminder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.reminder.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    await prisma.reminder.delete({ where: { id } });
    return res.status(200).json({ message: 'Reminder deleted' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
