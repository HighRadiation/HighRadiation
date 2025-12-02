#!/bin/bash

# 42 header fixer script
# Usage: ./fix_headers.sh

# Get the current user's login name
USER=$(whoami)

# Get current date
DATE=$(date +"%Y/%m/%d %H:%M:%S")

# Function to fix header in a file
fix_header() {
    local file="$1"
    local filename=$(basename "$file")

    # Check if file has a header
    if ! grep -q "/* \*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* \*/" "$file"; then
        return
    fi

    # Read the file content after the header
    content=$(awk '/\/\* \*+/{flag=1; count++} count>1{print}' "$file")

    # Create new header with exact 42 format
    cat > "$file" << EOF

/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   main.c                                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: $USER <$USER@student.42istanbul.com.tr>    +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: $DATE by $USER                           #+#    #+#             */
/*   Updated: $DATE by $USER                          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */


$content
EOF

    echo "Fixed: $file"
}

# Find all .c and .h files and fix their headers
find . -type f \( -name "*.c" -o -name "*.h" \) | while read -r file; do
    fix_header "$file"
done

echo "All headers have been fixed!"
