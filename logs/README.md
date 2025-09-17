# Logs Directory

This directory contains application logs and temporary log files.

## Current Logs

- **`bot.log`** - Main application log file
- **`ngrok.log`** - Ngrok tunneling service logs (for local development)

## Log Configuration

### Application Logging
The chatbot application logs to `bot.log` with different levels:
- **ERROR** - Critical errors and exceptions
- **WARN** - Warning messages and recoverable errors  
- **INFO** - General information and flow tracking
- **DEBUG** - Detailed debugging information

### Log Rotation
Logs are automatically managed and rotated to prevent disk space issues.

## Viewing Logs

### Real-time Monitoring
```bash
# Follow the main application log
tail -f logs/bot.log

# Follow with grep filtering
tail -f logs/bot.log | grep ERROR

# Follow multiple logs
tail -f logs/*.log
```

### Log Analysis
```bash
# Check for errors
grep ERROR logs/bot.log

# Check recent entries
tail -100 logs/bot.log

# Search for specific patterns
grep "webhook" logs/bot.log
```

## Log Files Ignored by Git

Log files are automatically ignored by git (see `.gitignore`):
```
logs/*.log
```

This prevents sensitive information and large files from being committed to the repository.

## Troubleshooting

### Common Log Patterns to Look For
- **Database connection issues**: Look for Supabase or connection errors
- **Facebook API issues**: Search for "Facebook" or "webhook" errors
- **Authentication problems**: Look for "auth" or "token" related errors
- **Performance issues**: Check for timeout or slow response warnings

### Log File Management
If log files become too large:
```bash
# Clear logs (be careful!)
> logs/bot.log

# Archive old logs
mv logs/bot.log logs/bot.log.$(date +%Y%m%d)
```

## Related

- **Configuration**: `../config/` - Application configuration
- **Source Code**: `../src/` - Application source with logging code