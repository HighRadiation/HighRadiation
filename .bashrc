# === 1. THEME: Clean Curved Bash Prompt ===
last_dir() {
  basename "$PWD"
}

# Advanced Git Branch Function (shows * if there are changes)
git_branch() {
  local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -n "$branch" ]; then
    local status=$(git status --porcelain 2>/dev/null)
    if [ -n "$status" ]; then
      echo " ($branch*)" 
    else
      echo " ($branch)"
    fi
  fi
}

set_prompt() {
  local exit_code=$?
  local color="\[\e[38;5;75m\]" # Blue if Success
  [ $exit_code -ne 0 ] && color="\[\e[38;5;196m\]" # Red if Error

  PS1="\[\e[38;5;81m\]\u \
\[\e[38;5;180m\]\$(last_dir) \
\[\e[38;5;109m\]\$(git_branch)\[\e[0m\]\n\
\[\e[38;5;245m\]╰─${color}\$ \[\e[0m\]"
}

PROMPT_COMMAND=set_prompt

# === 2. ALIASES ===
alias compile='cc -Wall -Wextra -Werror'
alias crun='compile main.c && ./a.out'
alias cls='clear'
alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# === 3. CUSTOM FUNCTIONS ===

# Create directory and enter it
mkcd() {
  mkdir -p "$1" && cd "$1"
}

# Smart Extractor
extract() {
  if [ -f $1 ] ; then
    case $1 in
      *.tar.bz2)   tar xjf $1     ;;
      *.tar.gz)    tar xzf $1     ;;
      *.bz2)       bunzip2 $1     ;;
      *.rar)       unrar x $1     ;;
      *.gz)        gunzip $1      ;;
      *.tar)       tar xf $1      ;;
      *.tbz2)      tar xjf $1     ;;
      *.tgz)       tar xzf $1     ;;
      *.zip)       unzip $1       ;;
      *.Z)         uncompress $1  ;;
      *.7z)        7z x $1        ;;
      *)           echo "'$1' cannot be extracted via extract()" ;;
    esac
  else
    echo "'$1' is not a valid file"
  fi
}

# === 4. SYSTEM SETTINGS ===

# LS Color Palette
export LS_COLORS='di=1;34:ln=35:so=32:pi=33:ex=31:bd=34;46:cd=34;43:su=30;41:sg=30;46:tw=30;42:ow=30;43'

# History Settings
export HISTTIMEFORMAT="%d/%m/%y %H:%M:%S "
export HISTCONTROL=ignoredups:erasedups
export HISTSIZE=10000
export HISTFILESIZE=20000
