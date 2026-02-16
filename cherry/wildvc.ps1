$currentPath = Split-Path $MyInvocation.MyCommand.Path -Parent
$inputFolder = Join-Path $currentPath 'video_files'
$outputFolder = Join-Path $currentPath 'video_files2'
$ffmpeg = Join-Path $currentPath 'ffmpeg\ffmpeg.exe'

# Создать выходную папку, если её нет
if (-not (Test-Path $outputFolder)) {
    New-Item -ItemType Directory -Path $outputFolder -Force
}

foreach($file in Get-ChildItem -Path $inputFolder) {
    Write-Host "------------Started next------------"
    
    $outputFile = Join-Path $outputFolder $file.Name
    $arguments = @(
        '-i', $file.FullName,
        '-c:v', 'libx265',
        '-c:a', 'copy',
        '-y',               # автоматически перезаписывать выходной файл
        $outputFile
    )
    
    # Запуск ffmpeg с аргументами
    & $ffmpeg $arguments
}

Read-Host -Prompt "Press any key to exit..."