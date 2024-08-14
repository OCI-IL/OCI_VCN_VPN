#!/usr/bin/env bash
var=$(date +"%FORMAT_STRING")
today=$(date "+%Y.%m.%d-%H.%M.%S")
filename=ip-${today}.json
curl -4 ifconfig.net/json  > ${filename}
curl -X PUT --data-binary @${filename} https://objectstorage.il-jerusalem-1.oraclecloud.com/p/{#########}/n/{#########}/b/{#########}/o/ip-${today}.json