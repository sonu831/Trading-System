param(
  [string]$cmd = "update",
  [string]$q = ""
)

$graphify = "uv tool run --from graphifyy graphify"

switch ($cmd) {
  "update"   { & $graphify update . }
  "full"     { & $graphify extract . }
  "query"    { if ($q) { & $graphify query $q } else { Write-Host "Usage: .\graph.ps1 query -q ""your question""`n"} }
  "open"     { Start-Item "graphify-out/graph.html" -ErrorAction SilentlyContinue; Write-Host "Open graphify-out/graph.html in your browser" }
  "explain"  { if ($q) { & $graphify explain $q } else { Write-Host "Usage: .\graph.ps1 explain -q ""symbol-name""`n"} }
  "path"     { if ($q) { $a,$b = $q -split ','; & $graphify path $a.Trim() $b.Trim() } else { Write-Host "Usage: .\graph.ps1 path -q ""NodeA, NodeB""`n"} }
  "help"     { & $graphify --help }
  default    { & $graphify $cmd $q }
}
