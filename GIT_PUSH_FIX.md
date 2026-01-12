# Fix Git Push to GitHub Issue

## Problem
Git is unable to push to GitHub due to SSL certificate verification errors:
```
fatal: unable to access 'https://github.com/...': error setting certificate verify locations: CAfile: /etc/ssl/cert.pem CApath: none
```

## Solutions

### Solution 1: Configure Git SSL Certificate (Recommended)

Run this command in your terminal to configure git to use the Homebrew certificate bundle:

```bash
git config --global http.sslCAInfo /opt/homebrew/etc/ca-certificates/cert.pem
```

Then try pushing again:
```bash
git push origin main
```

### Solution 2: Use System Certificate Bundle

If Solution 1 doesn't work, try using the system certificate:

```bash
git config --global http.sslCAInfo /etc/ssl/cert.pem
```

### Solution 3: Switch to SSH (Alternative)

If you have SSH keys set up with GitHub, switch the remote URL:

```bash
git remote set-url origin git@github.com:johnnaumann/anthroposcenic_001.git
git push origin main
```

To set up SSH keys (if not already done):
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to ssh-agent: `eval "$(ssh-agent -s)"` then `ssh-add ~/.ssh/id_ed25519`
3. Copy public key: `cat ~/.ssh/id_ed25519.pub`
4. Add to GitHub: Settings → SSH and GPG keys → New SSH key

### Solution 4: Temporary Workaround (Not Recommended)

Only use this if other solutions don't work:

```bash
git config --global http.sslVerify false
```

**Warning**: This disables SSL verification and is less secure. Only use temporarily.

## Verify the Fix

After applying a solution, verify it works:

```bash
git push origin main
```

You should see your commits being pushed successfully.

## Current Status

- **Branch**: `main`
- **Commits ahead**: 1 commit ready to push
- **Files to push**: PLAN.md, .cursorrules (already committed)
- **Remote**: `https://github.com/johnnaumann/anthroposcenic_001.git`
