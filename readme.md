# VCNVPN

This solution enables to create IP protection while client has dynamic IP for OCI.

## Client Side:

Bash script [start.sh](./start.sh) that make a request to https://ifconfig.net to get the public IP of the client, save JSON and upload it using PAR to the bucket (PAR might be expired someday)

## Cloud Side:

On "object create" event (Events service)
The Event service call the VCNVPN function.

The function downloads the JSON from the bucket,
parse the IP and check if it already “open” in the security list.
If not, it opens the ports based on the configuration.
UDP 20777 – Telemetry
TCP 8080, - Web Server
TCP 15672 – RabbitMQ Events
TCP 15675 – RabbitMQ Managment

Vars:

1. PAR (for the start.sh)
2. OCID:
   1. compartmentId
   2. vcnId
   3. seclistId

# How to install

## Cloud

1. create new OCI function
2. follow the quick start guide.
3. replace the content of the quick start with the provide func.js and package.json.
4. Update the var.

## Client

1. Create private bucket
2. Create PAR with Write permission
3. Update start.sh with the PAR.
4. Run the start.sh
5. (optional) put the start.sh to run on startup.

# Common errors in opening ports:

1. PAR expired – need to create one and update the bash script ion the PC.
2. The security list is full – need to clean ONLY old ips from the security list.
