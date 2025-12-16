$path = "src/components/AiAssistantCard.tsx"
$text = Get-Content $path -Raw
$pattern = 'interface AiAssistantCardProps {'
if ($text -notmatch 'mode: "personal" \| "business";') {
  $replacement = 'interface AiAssistantCardProps`n  mode: "personal" | "business";'
  $text = $text -replace [regex]::Escape($pattern), $replacement
}
Set-Content -Path $path -Value $text
