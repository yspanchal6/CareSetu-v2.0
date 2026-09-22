@echo off
echo === FOLDER A: Working Frontend ===
dir D:\2_YASH\SIH\CareSetu\CareSetu\frontend /B
echo === FOLDER B: Mock Frontend ===
dir D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu /B

echo === PACKAGE.JSON ===
echo [WORKING]
type D:\2_YASH\SIH\CareSetu\CareSetu\frontend\package.json | findstr /i "react axios socket.io-client firebase react-router-dom lucide-react tailwindcss"
echo [MOCK]
type D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\package.json | findstr /i "react axios socket.io-client firebase react-router-dom lucide-react tailwindcss"

echo === WORKING PAGES ===
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\pages\*.tsx 2>nul
echo === MOCK PAGES ===
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\pages\*.tsx 2>nul

echo === WORKING COMPONENTS ===
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\components\*.tsx 2>nul
echo === MOCK COMPONENTS ===
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\components\*.tsx 2>nul

echo === WORKING SERVICES ===
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\services\*.ts 2>nul
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\services\*.tsx 2>nul
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\api\*.ts 2>nul
echo === MOCK SERVICES ===
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\services\*.ts 2>nul
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\api\*.ts 2>nul

echo === WORKING: API calls ===
findstr /s /i "axios api.post api.get /api/" D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\*.tsx
findstr /s /i "axios api.post api.get /api/" D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\*.ts
echo === MOCK: API calls ===
findstr /s /i "axios api.post api.get /api/" D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\*.tsx
findstr /s /i "axios api.post api.get /api/" D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\*.ts

echo === WORKING UTILS ===
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\utils\ 2>nul
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\context\ 2>nul
echo === MOCK UTILS ===
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\utils\ 2>nul
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\context\ 2>nul

echo === WORKING PUBLIC ===
dir /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\public\
echo === MOCK PUBLIC ===
dir /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\public\

echo === WORKING: mock data ===
findstr /s /i "mockData mockCases sampleData dummyData demoAccounts" D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\*.tsx
echo === MOCK: mock data ===
findstr /s /i "mockData mockCases sampleData dummyData demoAccounts" D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\*.tsx

echo === WORKING FRONTEND total files ===
dir /S /B D:\2_YASH\SIH\CareSetu\CareSetu\frontend\src\ | find /c /v ""
echo === MOCK FRONTEND total files ===
dir /S /B D:\2_YASH\SIH\CareSetu\caresetu-frontend\caresetu\src\ | find /c /v ""
