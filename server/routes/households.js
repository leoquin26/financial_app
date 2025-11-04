const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const Household = require('../models/Household');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const { createNotification } = require('./notifications');
const { getIo } = require('../utils/socketManager');

const router = express.Router();

// Get user's households
router.get('/', authMiddleware, async (req, res) => {
    try {
        const households = await Household.find({
            'members.user': req.userId,
            isActive: true
        })
        .populate('createdBy', 'username email')
        .populate('members.user', 'username email')
        .sort({ createdAt: -1 });

        res.json(households);
    } catch (error) {
        console.error('Get households error:', error);
        res.status(500).json({ error: 'Failed to fetch households' });
    }
});

// Get single household with details
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const household = await Household.findById(req.params.id)
            .populate('createdBy', 'username email')
            .populate('members.user', 'username email');

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // Check if user is member
        if (!household.isMember(req.userId)) {
            return res.status(403).json({ error: 'Not authorized to view this household' });
        }

        // Get shared transactions count
        const sharedTransactionsCount = await Transaction.countDocuments({
            householdId: household._id
        });

        // Get shared categories count
        const sharedCategoriesCount = await Category.countDocuments({
            householdId: household._id
        });

        // Get shared budgets count
        const sharedBudgetsCount = await Budget.countDocuments({
            householdId: household._id
        });

        res.json({
            ...household.toObject(),
            stats: {
                transactions: sharedTransactionsCount,
                categories: sharedCategoriesCount,
                budgets: sharedBudgetsCount
            }
        });
    } catch (error) {
        console.error('Get household error:', error);
        res.status(500).json({ error: 'Failed to fetch household' });
    }
});

// Create new household
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, description, settings } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Create household with creator as owner
        const household = new Household({
            name,
            description,
            createdBy: req.userId,
            members: [{
                user: req.userId,
                role: 'owner',
                permissions: {
                    canAddTransactions: true,
                    canEditTransactions: true,
                    canDeleteTransactions: true,
                    canManageBudgets: true,
                    canManageCategories: true,
                    canInviteMembers: true,
                    canViewAnalytics: true
                }
            }],
            settings: settings || {}
        });

        await household.save();
        await household.populate('createdBy members.user');

        // Create notification
        const notification = await createNotification(
            req.userId.toString(),
            'success',
            '🏠 Hogar creado',
            `Has creado el hogar "${name}" exitosamente`,
            { householdId: household._id }
        );
        console.log('Household creation notification:', notification);

        res.status(201).json(household);
    } catch (error) {
        console.error('Create household error:', error);
        res.status(500).json({ error: 'Failed to create household' });
    }
});

// Update household
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, description, settings } = req.body;
        
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // Check permissions
        if (!household.hasPermission(req.userId, 'admin')) {
            return res.status(403).json({ error: 'Not authorized to update this household' });
        }

        // Update fields
        if (name) household.name = name;
        if (description !== undefined) household.description = description;
        if (settings) household.settings = { ...household.settings, ...settings };

        await household.save();
        await household.populate('createdBy members.user');

        // Notify members
        const io = getIo();
        household.members.forEach(member => {
            if (member.user._id.toString() !== req.userId) {
                io.to(`user_${member.user._id}`).emit('household-updated', household);
            }
        });

        res.json(household);
    } catch (error) {
        console.error('Update household error:', error);
        res.status(500).json({ error: 'Failed to update household' });
    }
});

// Send invitation
router.post('/:id/invite', authMiddleware, async (req, res) => {
    try {
        const { email, role = 'member', permissions, message } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const household = await Household.findById(req.params.id)
            .populate('members.user');
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // Check permissions - convert req.userId to string for comparison
        const userIdStr = req.userId.toString();
        const canInvite = household.hasPermission(userIdStr, 'canInviteMembers');
        
        // Enhanced debugging
        console.log('Invite permission check:', {
            userId: userIdStr,
            canInvite,
            members: household.members.map(m => ({
                userId: m.user._id ? m.user._id.toString() : m.user.toString(),
                role: m.role,
                permissions: m.permissions
            })),
            currentUserMember: household.members.find(m => {
                const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
                return memberUserId === userIdStr;
            })
        });
        
        if (!canInvite) {
            return res.status(403).json({ error: 'Not authorized to invite members' });
        }

        // Check if user already exists in household
        const invitedUser = await User.findOne({ email });
        if (invitedUser && household.isMember(invitedUser._id)) {
            return res.status(400).json({ error: 'User is already a member' });
        }

        // Check for ANY existing invitation for this email and household
        const existingInvitation = await Invitation.findOne({
            household: household._id,
            invitedEmail: email
        });

        // Only block if there's a valid pending invitation
        if (existingInvitation && existingInvitation.status === 'pending' && existingInvitation.isValid()) {
            return res.status(400).json({ error: 'Invitation already sent to this email' });
        }
        
        // If there was a previous invitation (rejected/accepted/expired), we can update it
        if (existingInvitation) {
            // Update the existing invitation to pending again
            existingInvitation.status = 'pending';
            existingInvitation.token = crypto.randomBytes(32).toString('hex');
            existingInvitation.expiresAt = new Date(+new Date() + 7*24*60*60*1000);
            existingInvitation.invitedBy = req.userId;
            existingInvitation.role = role;
            existingInvitation.permissions = permissions || {};
            existingInvitation.message = message;
            await existingInvitation.save();
            
            console.log('Re-invited user with updated invitation:', {
                email,
                invitationId: existingInvitation._id
            });
            
            // Send notification if user exists
            if (invitedUser) {
                const notification = await createNotification(
                    invitedUser._id.toString(),
                    'household_invitation',
                    '📨 Nueva invitación',
                    `Has sido invitado nuevamente al hogar "${household.name}"`,
                    { 
                        invitationId: existingInvitation._id, 
                        householdId: household._id,
                        invitedBy: req.userId,
                        token: existingInvitation.token
                    }
                );
                console.log('Re-invitation notification created:', notification);
            }
            
            return res.json({
                message: 'Invitation sent successfully',
                invitation: {
                    id: existingInvitation._id,
                    household: household.name,
                    email: existingInvitation.invitedEmail,
                    role: existingInvitation.role,
                    status: existingInvitation.status
                }
            });
        }

        // Create invitation
        const token = crypto.randomBytes(32).toString('hex');
        const invitation = new Invitation({
            household: household._id,
            invitedBy: req.userId,
            invitedEmail: email,
            invitedUser: invitedUser?._id,
            role,
            permissions: permissions || {},
            message,
            token
        });

        await invitation.save();

        // If user exists, create notification
        if (invitedUser) {
            const notification = await createNotification(
                invitedUser._id.toString(),
                'household_invitation',
                '📨 Nueva invitación',
                `Has sido invitado a unirte al hogar "${household.name}"`,
                { 
                    invitationId: invitation._id, 
                    householdId: household._id,
                    invitedBy: req.userId,
                    token: token
                }
            );
            console.log('Notification created:', notification);
        }

        // Real-time notifications
        try {
            const io = getIo();
            
            // Notify the invited user if they exist
            if (invitedUser) {
                io.to(`user_${invitedUser._id}`).emit('new-invitation', {
                    invitation: {
                        id: invitation._id,
                        token: invitation.token,
                        household: { 
                            name: household.name, 
                            id: household._id 
                        },
                        invitedBy: req.userId,
                        role: invitation.role,
                        message: invitation.message
                    }
                });
            }
            
            // Notify all household members that a new invitation was sent
            household.members.forEach(member => {
                const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
                io.to(`user_${memberUserId}`).emit('invitation-sent', {
                    household: household._id,
                    householdName: household.name,
                    invitedEmail: email,
                    sentBy: req.userId
                });
            });
            
            // Notify all users to refresh their invitation lists
            io.emit('invitations-updated');
            
        } catch (notifyError) {
            console.error('Error sending real-time notifications:', notifyError);
        }

        res.status(201).json({
            message: 'Invitation sent successfully',
            invitation: {
                id: invitation._id,
                email: invitation.invitedEmail,
                role: invitation.role,
                status: invitation.status
            }
        });
    } catch (error) {
        console.error('Send invitation error:', error);
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to send invitation', details: error.message });
    }
});

// Accept invitation
router.post('/invitations/:token/accept', authMiddleware, async (req, res) => {
    try {
        const invitation = await Invitation.findOne({ token: req.params.token })
            .populate('household');

        if (!invitation) {
            console.log('Invitation not found for token:', req.params.token);
            return res.status(404).json({ error: 'Invitation not found' });
        }

        console.log('Invitation found:', {
            id: invitation._id,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            isExpired: invitation.isExpired(),
            isValid: invitation.isValid()
        });

        if (!invitation.isValid()) {
            return res.status(400).json({ 
                error: 'Invitation is no longer valid',
                details: {
                    status: invitation.status,
                    expired: invitation.isExpired(),
                    expiresAt: invitation.expiresAt
                }
            });
        }

        // Verify the invitation is for this user
        const user = await User.findById(req.userId);
        if (invitation.invitedEmail !== user.email) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Add user to household (get fresh copy, don't use populated one)
        const householdId = invitation.household._id || invitation.household;
        const household = await Household.findById(householdId);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // Check if already member
        if (household.isMember(req.userId)) {
            return res.status(400).json({ error: 'You are already a member of this household' });
        }

        // Add member
        household.members.push({
            user: req.userId,
            role: invitation.role,
            permissions: invitation.permissions
        });

        await household.save();

        // Update invitation
        invitation.status = 'accepted';
        invitation.acceptedAt = new Date();
        invitation.invitedUser = req.userId;
        await invitation.save();

        // Notify household members (wrap in try-catch to prevent errors from breaking the response)
        try {
            const io = getIo();
            
            // Notify all household members about the new member
            household.members.forEach(member => {
                const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
                if (memberUserId !== req.userId.toString()) {
                    io.to(`user_${memberUserId}`).emit('member-joined', {
                        household: household._id,
                        householdName: household.name,
                        newMember: { 
                            id: req.userId, 
                            username: user.username,
                            email: user.email 
                        }
                    });
                }
            });
            
            // Notify the inviter specifically that their invitation was accepted
            io.to(`user_${invitation.invitedBy.toString()}`).emit('invitation-accepted', {
                invitationId: invitation._id,
                household: household._id,
                householdName: household.name,
                acceptedBy: {
                    id: req.userId,
                    username: user.username,
                    email: user.email
                }
            });
            
            // Notify all users to refresh their invitation lists
            io.emit('invitations-updated');
            
        } catch (notifyError) {
            console.error('Error notifying members:', notifyError);
            // Don't fail the request if notification fails
        }

        // Create notification for inviter (wrap in try-catch)
        try {
            await createNotification(
                invitation.invitedBy.toString(),
                'success',
                '✅ Invitación aceptada',
                `${user.username} se ha unido al hogar "${household.name}"`,
                { householdId: household._id }
            );
        } catch (notifyError) {
            console.error('Error creating notification:', notifyError);
            // Don't fail the request if notification fails
        }

        console.log('Invitation accepted successfully:', {
            userId: req.userId,
            householdId: household._id,
            invitationId: invitation._id
        });

        // Send success response
        return res.status(200).json({
            success: true,
            message: 'Successfully joined household',
            household: {
                id: household._id,
                name: household.name
            }
        });
    } catch (error) {
        console.error('Accept invitation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to accept invitation', details: error.message });
    }
});

// Reject invitation
router.post('/invitations/:token/reject', authMiddleware, async (req, res) => {
    try {
        const invitation = await Invitation.findOne({ token: req.params.token });

        if (!invitation) {
            console.log('Invitation not found for token:', req.params.token);
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify the invitation is for this user
        const user = await User.findById(req.userId);
        if (invitation.invitedEmail !== user.email) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Update invitation status
        invitation.status = 'rejected';
        invitation.rejectedAt = new Date();
        await invitation.save();

        console.log('Invitation rejected:', {
            userId: req.userId,
            invitationId: invitation._id
        });
        
        // Real-time notification to inviter
        try {
            const io = getIo();
            
            // Notify the inviter that their invitation was rejected
            io.to(`user_${invitation.invitedBy.toString()}`).emit('invitation-rejected', {
                invitationId: invitation._id,
                rejectedBy: {
                    email: user.email,
                    username: user.username
                }
            });
            
            // Notify all users to refresh their invitation lists
            io.emit('invitations-updated');
            
            // Create notification for inviter
            await createNotification(
                invitation.invitedBy.toString(),
                'info',
                '❌ Invitación rechazada',
                `${user.username} ha rechazado la invitación al hogar`,
                { invitationId: invitation._id }
            );
        } catch (notifyError) {
            console.error('Error notifying about rejection:', notifyError);
        }

        // Send success response
        return res.status(200).json({
            success: true,
            message: 'Invitation rejected successfully'
        });
    } catch (error) {
        console.error('Reject invitation error:', error);
        return res.status(500).json({ error: 'Failed to reject invitation' });
    }
});

// Get user's invitations
router.get('/invitations/my', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        const invitations = await Invitation.find({
            invitedEmail: user.email,
            status: 'pending'
        })
        .populate('household', 'name description')
        .populate('invitedBy', 'username email')
        .sort({ createdAt: -1 });

        // Filter out expired invitations and include token
        const validInvitations = invitations
            .filter(inv => inv.isValid())
            .map(inv => ({
                ...inv.toObject(),
                token: inv.token // Include token for accepting
            }));

        res.json(validInvitations);
    } catch (error) {
        console.error('Get invitations error:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// Leave household
router.post('/:id/leave', authMiddleware, async (req, res) => {
    try {
        const household = await Household.findById(req.params.id)
            .populate('members.user');
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        console.log('Leave household attempt:', {
            householdId: req.params.id,
            userId: req.userId,
            members: household.members.map(m => ({
                userId: m.user._id ? m.user._id.toString() : m.user.toString(),
                role: m.role
            }))
        });

        // Check if user is member
        if (!household.isMember(req.userId)) {
            return res.status(403).json({ error: 'You are not a member of this household' });
        }

        // Check if user is owner
        const memberRole = household.getMemberRole(req.userId);
        if (memberRole === 'owner') {
            // Check if there are other admins
            const otherAdmins = household.members.filter(m => 
                m.user.toString() !== req.userId && 
                (m.role === 'admin' || m.role === 'owner')
            );

            if (otherAdmins.length === 0 && household.members.length > 1) {
                return res.status(400).json({ 
                    error: 'Cannot leave household as owner. Promote another member to admin first.' 
                });
            }
        }

        // Remove member - handle both populated and unpopulated cases
        household.members = household.members.filter(m => {
            const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return memberUserId !== req.userId.toString();
        });

        // If no members left, deactivate household
        if (household.members.length === 0) {
            household.isActive = false;
        }

        await household.save();

        // Notify other members
        const io = getIo();
        household.members.forEach(member => {
            io.to(`user_${member.user}`).emit('member-left', {
                household: household._id,
                leftMemberId: req.userId
            });
        });

        res.json({ message: 'Successfully left household' });
    } catch (error) {
        console.error('Leave household error:', error);
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to leave household', details: error.message });
    }
});

// Get household details by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const household = await Household.findById(req.params.id)
            .populate('createdBy', 'username email')
            .populate('members.user', 'username email');
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }
        
        // Check if user is a member
        if (!household.isMember(req.userId)) {
            return res.status(403).json({ error: 'Not authorized to view this household' });
        }
        
        res.json(household);
    } catch (error) {
        console.error('Get household details error:', error);
        res.status(500).json({ error: 'Failed to fetch household details' });
    }
});

// Get shared transactions
router.get('/:id/transactions', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 50, type, categoryId, startDate, endDate } = req.query;
        
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // Check if user is member
        if (!household.isMember(req.userId)) {
            return res.status(403).json({ error: 'Not authorized to view household transactions' });
        }

        // Build query
        const query = { householdId: household._id };
        
        if (type) query.type = type;
        if (categoryId) query.categoryId = categoryId;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Get transactions
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const transactions = await Transaction.find(query)
            .populate('userId', 'username email')
            .populate('categoryId')
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Transaction.countDocuments(query);

        res.json({
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get household transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch household transactions' });
    }
});

// Update member permissions
router.put('/:householdId/members/:userId', authMiddleware, async (req, res) => {
    try {
        const { role, permissions } = req.body;
        
        const household = await Household.findById(req.params.householdId);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // Check if requester has permission
        const requesterRole = household.getMemberRole(req.userId);
        if (requesterRole !== 'owner' && requesterRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to update member permissions' });
        }

        // Find member to update
        const memberIndex = household.members.findIndex(m => 
            m.user.toString() === req.params.userId
        );

        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Cannot change owner role
        if (household.members[memberIndex].role === 'owner' && role !== 'owner') {
            return res.status(400).json({ error: 'Cannot change owner role' });
        }

        // Update member
        if (role) household.members[memberIndex].role = role;
        if (permissions) {
            household.members[memberIndex].permissions = {
                ...household.members[memberIndex].permissions,
                ...permissions
            };
        }

        await household.save();
        await household.populate('members.user');

        // Notify updated member
        const io = getIo();
        io.to(`user_${req.params.userId}`).emit('permissions-updated', {
            household: household._id,
            newRole: role,
            newPermissions: permissions
        });

        res.json(household);
    } catch (error) {
        console.error('Update member permissions error:', error);
        res.status(500).json({ error: 'Failed to update member permissions' });
    }
});

// Get household budgets
router.get('/:id/budgets', authMiddleware, async (req, res) => {
    try {
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }
        
        if (!household.isMember(req.userId)) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        // Get all member IDs
        const memberIds = household.members.map(m => 
            m.user._id ? m.user._id.toString() : m.user.toString()
        );
        
        // Get budgets for all household members
        const budgets = await Budget.find({
            userId: { $in: memberIds },
            isActive: true
        }).populate('categoryId');
        
        // Calculate spent amounts
        const budgetsWithSpent = await Promise.all(budgets.map(async (budget) => {
            const spent = await Transaction.aggregate([
                {
                    $match: {
                        userId: { $in: memberIds.map(id => new mongoose.Types.ObjectId(id)) },
                        categoryId: budget.categoryId._id,
                        type: 'expense',
                        date: {
                            $gte: budget.startDate,
                            $lte: budget.endDate
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ]);
            
            return {
                ...budget.toObject(),
                spent: spent[0]?.total || 0
            };
        }));
        
        res.json(budgetsWithSpent);
    } catch (error) {
        console.error('Get household budgets error:', error);
        res.status(500).json({ error: 'Failed to fetch household budgets' });
    }
});

// Get household analytics
router.get('/:id/analytics', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }
        
        if (!household.isMember(req.userId)) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        // Get all member IDs
        const memberIds = household.members.map(m => 
            m.user._id ? m.user._id.toString() : m.user.toString()
        );
        
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        
        // Category breakdown
        const categoryBreakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: { $in: memberIds.map(id => new mongoose.Types.ObjectId(id)) },
                    type: 'expense',
                    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $group: {
                    _id: '$categoryId',
                    name: { $first: '$category.name' },
                    color: { $first: '$category.color' },
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);
        
        // Monthly trend
        const monthlyTrend = await Transaction.aggregate([
            {
                $match: {
                    userId: { $in: memberIds.map(id => new mongoose.Types.ObjectId(id)) },
                    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        type: '$type'
                    },
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        
        // Format monthly trend
        const trendByMonth = {};
        monthlyTrend.forEach(item => {
            const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
            if (!trendByMonth[key]) {
                trendByMonth[key] = { month: key, income: 0, expenses: 0 };
            }
            if (item._id.type === 'income') {
                trendByMonth[key].income = item.total;
            } else {
                trendByMonth[key].expenses = item.total;
            }
        });
        
        const formattedTrend = Object.values(trendByMonth);
        
        // Calculate totals
        const totals = await Transaction.aggregate([
            {
                $match: {
                    userId: { $in: memberIds.map(id => new mongoose.Types.ObjectId(id)) },
                    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        const income = totals.find(t => t._id === 'income')?.total || 0;
        const expenses = totals.find(t => t._id === 'expense')?.total || 0;
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
        
        res.json({
            categoryBreakdown,
            monthlyTrend: formattedTrend,
            topCategory: categoryBreakdown[0],
            savingsRate,
            totals: {
                income,
                expenses,
                balance: income - expenses
            }
        });
    } catch (error) {
        console.error('Get household analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch household analytics' });
    }
});

// Update member permissions
router.put('/:id/members/:memberId/permissions', authMiddleware, async (req, res) => {
    try {
        const { permissions } = req.body;
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }
        
        // Check if user has permission to manage members
        if (!household.hasPermission(req.userId, 'canInviteMembers')) {
            return res.status(403).json({ error: 'Not authorized to manage members' });
        }
        
        // Find and update member
        const memberIndex = household.members.findIndex(m => {
            const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return memberUserId === req.params.memberId;
        });
        
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        // Don't allow changing owner permissions
        if (household.members[memberIndex].role === 'owner') {
            return res.status(400).json({ error: 'Cannot change owner permissions' });
        }
        
        household.members[memberIndex].permissions = {
            ...household.members[memberIndex].permissions,
            ...permissions
        };
        
        await household.save();
        
        // Emit socket event
        const io = getIo();
        io.to(`user_${req.params.memberId}`).emit('permissions-updated', {
            household: household._id,
            permissions
        });
        
        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('Update member permissions error:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

// Remove member from household
router.delete('/:id/members/:memberId', authMiddleware, async (req, res) => {
    try {
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }
        
        // Check if user has permission to manage members
        const userRole = household.getMemberRole(req.userId);
        if (!['owner', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Not authorized to remove members' });
        }
        
        // Find member to remove
        const memberToRemove = household.members.find(m => {
            const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return memberUserId === req.params.memberId;
        });
        
        if (!memberToRemove) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        // Don't allow removing the owner
        if (memberToRemove.role === 'owner') {
            return res.status(400).json({ error: 'Cannot remove the owner' });
        }
        
        // Remove member
        household.members = household.members.filter(m => {
            const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return memberUserId !== req.params.memberId;
        });
        
        await household.save();
        
        // Notify removed member
        const io = getIo();
        io.to(`user_${req.params.memberId}`).emit('removed-from-household', {
            household: household._id,
            householdName: household.name
        });
        
        // Notify other members
        household.members.forEach(member => {
            const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
            io.to(`user_${memberUserId}`).emit('member-removed', {
                household: household._id,
                removedMemberId: req.params.memberId
            });
        });
        
        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// Update household settings
router.put('/:id/settings', authMiddleware, async (req, res) => {
    try {
        const { name, description, settings } = req.body;
        const household = await Household.findById(req.params.id);
        
        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }
        
        // Only owner can update settings
        const userRole = household.getMemberRole(req.userId);
        if (userRole !== 'owner') {
            return res.status(403).json({ error: 'Only owner can update household settings' });
        }
        
        // Update fields
        if (name) household.name = name;
        if (description !== undefined) household.description = description;
        if (settings) household.settings = { ...household.settings, ...settings };
        
        await household.save();
        
        // Notify all members
        const io = getIo();
        household.members.forEach(member => {
            const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
            io.to(`user_${memberUserId}`).emit('household-settings-updated', {
                household: household._id,
                name: household.name,
                description: household.description,
                settings: household.settings
            });
        });
        
        res.json({ message: 'Settings updated successfully', household });
    } catch (error) {
        console.error('Update household settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;

