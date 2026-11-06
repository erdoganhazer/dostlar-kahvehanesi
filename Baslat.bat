@echo off
title Kart Salonu
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sunucu.ps1"
if errorlevel 1 pause
