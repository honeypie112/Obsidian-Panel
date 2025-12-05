#!/usr/bin/env fish
# Load environment variables from .env file into Fish shell

set -l env_file ".env"

# Check if .env file exists
if not test -f $env_file
    echo "❌ Error: .env file not found!"
    echo "💡 Create one from .env.example: cp .env.example .env"
    exit 1
end

echo "🐟 Loading environment variables from .env..."

# Read each line from .env file
while read -l line
    # Skip empty lines and comments
    if test -z "$line"; or string match -q '#*' $line
        continue
    end
    
    # Split on first '=' sign
    set -l parts (string split -m 1 '=' $line)
    
    if test (count $parts) -eq 2
        set -l var_name (string trim $parts[1])
        set -l var_value (string trim $parts[2])
        
        # Remove quotes if present
        set var_value (string replace -r '^["\']|["\']$' '' $var_value)
        
        # Export the variable
        set -gx $var_name $var_value
        echo "  ✅ $var_name"
    end
end < $env_file

echo "✨ Done! Environment variables loaded into current Fish session."
echo ""
echo "💡 To make these permanent, use: set -Ux VARIABLE_NAME value"
