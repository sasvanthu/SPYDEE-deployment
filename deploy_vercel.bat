@echo off
title SPYDEE Vercel Deployment
echo ========================================================
echo   SPYDEE Frontend Deployment to Vercel (Showcase Mode)
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_vercel.ps1"
pause
