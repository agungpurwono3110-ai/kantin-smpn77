@echo off
title SISTEM KANTIN SMPN 77 - SERVER KASIR
color 0A
cls
echo ========================================================
echo       MEMULAI SISTEM KANTIN SMPN 77 (SERVER & DATABASE)
echo ========================================================
echo.

:: Periksa apakah Node.js sudah terinstal
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [PERINGATAN] Node.js belum terdeteksi di komputer ini.
    echo Aplikasi akan langsung membuka antarmuka lokal di browser Anda...
    echo.
    start "" index.html
    pause
    exit /b
)

:: Periksa apakah node_modules sudah ada
if not exist "node_modules\" (
    echo [INFO] Menginstal modul sistem dan database SQLite pertama kali...
    echo Harap tunggu sebentar...
    call npm install
    echo.
)

echo [INFO] Menyalakan server database SQLite terpusat...
echo [INFO] Membuka browser secara otomatis...
echo.

:: Buka browser ke alamat aplikasi lokal setelah 2 detik
start timeout /t 2 >nul & start http://localhost:3000

:: Jalankan server Node.js
node server.js

pause
