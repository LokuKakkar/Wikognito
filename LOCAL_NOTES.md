# Wikognito: local notes (not committed)

## Access

```bash
ssh -i /home/lokeshkakkar/projects/keyss/ssh-key-2026-11-03.key ubuntu@130.210.61.244
```

- VM user is **`ubuntu`** (not `opc`). Home is `/home/ubuntu`, so use that in the systemd unit and backup paths.
- Public IP: 130.210.61.244 (confirm whether it's ephemeral or reserved).
- If your home IP changes, update the SSH ingress rule in the OCI security list.

Copy a file off the VM:

```bash
scp -i /home/lokeshkakkar/projects/keyss/ssh-key-2026-11-03.key ubuntu@130.210.61.244:~/backups/<file>.dump ~/wikognito-offbox/
```

## Checklist

1. [ ] Backups: manual run, restore drill, systemd timer installed
2. [ ] Off-box copy (scp now, rclone/Object Storage later)
3. [ ] Reboot test
4. [ ] Cost check ($0 in Cost Analysis, $1 budget alert)
5. [ ] Merge to main (needs explicit OK before push/PR); decide whether the VM tracks main
6. [ ] Docs update (docs/deployment.md)
7. [ ] Idle reclamation watch (first few weeks)
8. [ ] Nice to have: uptime monitor on /health/ready, delete old Render services, off-VM copies of .env.prod / snapshots / corpus JSON
