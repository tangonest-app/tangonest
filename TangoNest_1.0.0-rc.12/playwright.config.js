const {defineConfig,devices}=require("@playwright/test");

module.exports=defineConfig({
  testDir:"./tests/e2e",
  fullyParallel:false,
  workers:1,
  timeout:30000,
  expect:{timeout:5000},
  reporter:[["list"],["html",{outputFolder:"test-results/report",open:"never"}]],
  snapshotPathTemplate:"{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  use:{
    baseURL:"http://127.0.0.1:4173",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"off"
  },
  projects:[
    {name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1280,height:720}}},
    {name:"mobile",use:{...devices["iPhone 13"],browserName:"chromium",viewport:{width:390,height:844}}},
    {name:"webkit",use:{...devices["Desktop Safari"],viewport:{width:1280,height:720}}}
  ],
  webServer:{
    command:"python3 -m http.server 4173 --bind 127.0.0.1",
    url:"http://127.0.0.1:4173",
    reuseExistingServer:true,
    timeout:10000
  },
  outputDir:"test-results/artifacts"
});
