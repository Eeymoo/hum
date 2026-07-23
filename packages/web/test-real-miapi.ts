import { buildEncryptedParams, decryptResponse } from '@/lib/sync/mi-crypto'
import fs from 'fs'
const token = JSON.parse(fs.readFileSync('/home/opencode/Codes/hum/.tmp/token.json','utf8'))
const UA='PassportSDK/5.3.0.release.79 XiaomiAccountSSO/5.3.0.release.79'
async function main(){
  const path='/app/v1/data/get_aggregated_fitness_data_by_time'
  const now=Math.floor(Date.now()/1000)
  const start=now-7*24*60*60
  const enc=buildEncryptedParams('GET',path,token.ssecurity,{relative_uid:0,key:'steps',tag:'daily_report',start_time:start,end_time:now,limit:10})
  const url=new URL(path,'https://hlth.io.mi.com')
  for(const[k,v]of Object.entries(enc))url.searchParams.set(k,v)
  console.log('URL data param:', url.searchParams.get('data')?.slice(0,60))
  const r=await fetch(url.toString(),{headers:{'User-Agent':UA,'Cookie':`cUserId=${token.c_user_id}; serviceToken=${token.service_token}; locale=zh_CN`}})
  const text=await r.text()
  const d=decryptResponse(token.ssecurity,enc._nonce,text) as any
  console.log('code:',d.code,'message:',d.message,'data_list:',d.result?.data_list?.length||0,'条')
}
main().catch(e=>console.error(e))
