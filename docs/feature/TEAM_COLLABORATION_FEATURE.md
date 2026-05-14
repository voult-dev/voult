# Team Collaboration Feature - Implementation Plan

## Overview

This document outlines the implementation plan for adding team collaboration capabilities to Voult. This feature will allow developers to invite other developers to collaborate on their authentication apps, with role-based access control.

## Problem Statement

Currently, Voult apps have a single owner (`owner` field in App model). This limits collaboration as:
- Teams cannot work together on the same auth configuration
- Only one developer has access to OAuth credentials and settings
- No way to delegate access or share responsibilities
- Not suitable for agencies, startups, or enterprise teams

## Proposed Solution

Implement a team-based access system that allows multiple developers to collaborate on apps with granular permissions.

---

## Database Schema Changes

### 1. Team Model (New)

```javascript
// models/team.js
const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    required: true
  },
  members: [{
    developer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Developer'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'developer', 'viewer'],
      default: 'developer'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Developer'
    }
  }],
  invitations: [{
    email: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'developer', 'viewer'],
      default: 'developer'
    },
    token: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Developer'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    defaultRole: {
      type: String,
      enum: ['admin', 'developer', 'viewer'],
      default: 'developer'
    },
    requireApprovalForApps: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });
```

### 2. App Model Changes

```javascript
// Modify models/app.js
const AppSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // Change from single owner to team ownership
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  
  // Keep owner for backward compatibility (or remove in breaking change)
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    required: true
  },
  
  // ... rest of existing fields
});
```

---

## API Endpoints

### Team Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teams` | Create a new team |
| GET | `/api/teams` | List user's teams |
| GET | `/api/teams/:id` | Get team details with members |
| PUT | `/api/teams/:id` | Update team settings |
| DELETE | `/api/teams/:id` | Delete a team (owner only) |

### Team Members

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teams/:id/members/invite` | Invite a developer to team |
| POST | `/api/teams/invite/:token/accept` | Accept team invitation |
| DELETE | `/api/teams/:id/members/:developerId` | Remove member from team |
| PUT | `/api/teams/:id/members/:developerId/role` | Change member role |

### App Access (Modified)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps` | List apps (team + personal) |
| POST | `/api/apps` | Create app (assign to team or personal) |
| GET | `/api/apps/:id` | Get app details (check team access) |
| PUT | `/api/apps/:id` | Update app (team permission check) |

---

## Permission System

### Role Definitions

| Role | Create App | View App | Edit App | Manage OAuth | Manage Team | Delete App |
|------|------------|----------|----------|--------------|-------------|------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Developer** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Viewer** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Middleware Implementation

```javascript
// middleware/requireTeamRole.js
const { ApiError } = require('../utils/apiError');

const TEAM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer'
};

const ROLE_HIERARCHY = {
  [TEAM_ROLES.OWNER]: 4,
  [TEAM_ROLES.ADMIN]: 3,
  [TEAM_ROLES.DEVELOPER]: 2,
  [TEAM_ROLES.VIEWER]: 1
};

module.exports = function requireTeamRole(minRole) {
  return async (req, res, next) => {
    try {
      const { teamId } = req.params;
      const team = await Team.findOne({ _id: teamId });
      
      if (!team) {
        throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
      }
      
      // Find user's membership
      const membership = team.members.find(
        m => m.developer.toString() === req.user._id.toString()
      );
      
      if (!membership) {
        throw new ApiError(403, 'NOT_TEAM_MEMBER', 'Not a member of this team');
      }
      
      // Check role hierarchy
      if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
        throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions');
      }
      
      req.teamMembership = membership;
      req.team = team;
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

---

## Implementation Phases

### Phase 1: Core Team Infrastructure (MVP)

1. **Create Team Model**
   - [ ] Create `models/team.js`
   - [ ] Add team schema with basic fields
   - [ ] Add instance methods for invitations

2. **Team CRUD API**
   - [ ] Create team endpoint
   - [ ] List user's teams endpoint
   - [ ] Update team endpoint
   - [ ] Delete team endpoint

3. **Basic Invitation System**
   - [ ] Generate invitation tokens
   - [ ] Send invitation emails
   - [ ] Accept invitation endpoint
   - [ ] Expire invitations after 7 days

4. **Web Dashboard Updates**
   - [ ] Team settings page
   - [ ] Member management UI
   - [ ] Invitation UI

### Phase 2: App Access Integration

1. **Modify App Model**
   - [ ] Add `team` field to App schema
   - [ ] Update app creation to support team assignment
   - [ ] Migration script for existing apps

2. **Permission Middleware**
   - [ ] Create `requireTeamRole` middleware
   - [ ] Update app controllers to check team permissions
   - [ ] Add permission checks to all app routes

3. **API Updates**
   - [ ] Update app listing to include team apps
   - [ ] Add team filter to app queries
   - [ ] Update app creation to assign team

### Phase 3: Advanced Features

1. **Audit Logging**
   - [ ] Create audit log model
   - [ ] Log team member changes
   - [ ] Log app configuration changes
   - [ ] Display audit log in dashboard

2. **Enhanced Permissions**
   - [ ] Granular permission system
   - [ ] Custom role creation
   - [ ] Resource-level permissions

3. **Team Analytics**
   - [ ] Team usage dashboard
   - [ ] Per-member activity tracking
   - [ ] Team billing integration

---

## File Changes Summary

### New Files
```
models/team.js
models/teamInvitation.js
models/auditLog.js
controllers/api/team.js
controllers/web/team.js
routes/api/team.js
routes/web/team.js
middleware/requireTeamRole.js
services/teamInvitation.js
views/team/
views/team/dashboard.ejs
views/team/members.ejs
views/team/invitations.ejs
views/team/settings.ejs
```

### Modified Files
```
models/app.js          - Add team field
controllers/web/app.js - Add team permission checks
routes/web/app.js      - Add team routes
routes/api/app.js      - Add team permission checks
middleware.js          - Register new middleware
```

---

## Security Considerations

1. **Invitation Security**
   - Use cryptographically secure tokens
   - Set expiration (7 days default)
   - Invalidate on acceptance or rejection
   - Rate limit invitation sending

2. **Permission Enforcement**
   - Always verify team membership server-side
   - Never trust client-side role claims
   - Implement proper authorization on all endpoints

3. **Audit Trail**
   - Log all team membership changes
   - Log all permission changes
   - Log sensitive operations (OAuth config changes)

---

## Testing Strategy

1. **Unit Tests**
   - Team model methods
   - Invitation token generation
   - Permission middleware

2. **Integration Tests**
   - Team CRUD operations
   - Invitation flow
   - App access with team permissions

3. **E2E Tests**
   - Full invitation and acceptance flow
   - Multi-user collaboration scenarios
   - Permission escalation prevention

---

## Migration Strategy

For existing apps without teams:

```javascript
// Migration script
async function migrateAppsToPersonalTeams() {
  const apps = await App.find({ team: { $exists: false } });
  
  for (const app of apps) {
    // Create personal team for owner
    const team = await Team.create({
      name: `${app.owner.name}'s Team`,
      owner: app.owner,
      members: [{
        developer: app.owner,
        role: 'owner'
      }]
    });
    
    app.team = team._id;
    await app.save();
  }
}
```

---

## Success Metrics

- [ ] Teams can be created and managed
- [ ] Developers can be invited to teams
- [ ] Team members can collaborate on apps
- [ ] Permissions are enforced correctly
- [ ] No security vulnerabilities in access control
- [ ] Backward compatibility maintained for existing apps

---

## References

- [Auth0 Teams Documentation](https://auth0.com/docs/get-started/dashboard-tenant-dashboard/team-members)
- [Clerk Organizations](https://clerk.com/docsorganizations/overview)
- [Supabase Organizations](https://supabase.com/docs/guides/platform/platform-and-api-reference#organizations)