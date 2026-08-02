# Copies the library + dictionaries into the extension folder so it is
# self-contained (manifest paths must resolve inside the extension root).
# Run after any mcphee.js change, then reload the add-on in about:debugging.
$root = Split-Path $PSScriptRoot -Parent
Copy-Item "$root\mcphee.js" "$PSScriptRoot\mcphee.js" -Force
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\vendor\typo" | Out-Null
Copy-Item "$root\vendor\typo\typo.min.js" "$PSScriptRoot\vendor\typo\" -Force
Copy-Item "$root\vendor\typo\en_US.aff" "$PSScriptRoot\vendor\typo\" -Force
Copy-Item "$root\vendor\typo\en_US.dic" "$PSScriptRoot\vendor\typo\" -Force
Write-Host "Extension assets copied. Load extension/manifest.json via about:debugging."
