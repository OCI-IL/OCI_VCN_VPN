const fdk = require("@fnproject/fdk");
const os = require("oci-objectstorage");
const common = require("oci-common");
const fs = require("fs");

const core = require("oci-core");

const secListRules = {
  tag: "f1",
  compartmentId: "ocid1.compartment.oc1..aaaaaaaaq",
  vcnId: "ocid1.vcn.oc1.il-jerusalem-1.amaaaaaaenq",
  seclistId: "ocid1.securitylist.oc1.il-jerusalem-1.aaaaaaaa",
  ports: [
    { protocol: "UDP", port: 20777 },
    { protocol: "TCP", port: 8080 },
    { protocol: "TCP", port: 15672 },
    { protocol: "TCP", port: 15675 },
  ],
};

const listSecList = async (
  provider,
  compartmentId,
  vcnId,
  seclistId,
  displayName
) => {
  try {
    // Create a service client
    const client = new core.VirtualNetworkClient({
      authenticationDetailsProvider: provider,
    });

    // Create a request and dependent object(s).
    const listSecurityListsRequest = {
      compartmentId,
      vcnId,
      displayName,
    };

    // Send request to the Client.
    const listSecurityListsResponse = await client.listSecurityLists(
      listSecurityListsRequest
    );

    const { items } = listSecurityListsResponse;
    console.log("listSecurityListsResponse.items", JSON.stringify(items));
    let secList = undefined;

    for (const element of items) {
      if (element.id == seclistId) {
        secList = element;
        break;
      }
    }

    return secList;
  } catch (error) {
    console.log("listSecurityLists Failed with error  " + error);
  }
};

const updSecList = async (
  provider,
  secListId,
  sourceIp,
  ports,
  currentRules
) => {
  const client = new core.VirtualNetworkClient({
    authenticationDetailsProvider: provider,
  });

  const updateSecurityListRequest = {
    securityListId: secListId,
    updateSecurityListDetails: {
      ingressSecurityRules: currentRules,
    },
  };

  for (const element of ports) {
    let rule = undefined;
    if (element.protocol == "UDP") {
      rule = {
        isStateless: false,
        protocol: "17",
        source: sourceIp,
        sourceType: "CIDR_BLOCK",
        udpOptions: {
          destinationPortRange: {
            max: element.port,
            min: element.port,
          },
        },
      };
    } else if (element.protocol == "TCP") {
      rule = {
        isStateless: false,
        protocol: "6",
        source: sourceIp,
        sourceType: "CIDR_BLOCK",
        tcpOptions: {
          destinationPortRange: {
            max: element.port,
            min: element.port,
          },
        },
      };
    }
    updateSecurityListRequest.updateSecurityListDetails.ingressSecurityRules.push(
      rule
    );
  }

  try {
    // Send request to the Client.
    const updateSecurityListResponse = await client.updateSecurityList(
      updateSecurityListRequest
    );

    console.log(
      "updateSecurityListResponse",
      JSON.stringify(updateSecurityListResponse)
    );
    return;
  } catch (error) {
    console.log("updateSecurityList Failed with error  " + error);
  }

  function streamToStringA(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  fdk.handle(async (input) => {
    const provider =
      await common.ResourcePrincipalAuthenticationDetailsProvider.builder();
    const compartmentId = input.data.compartmentId;
    const bucket = input.data.additionalDetails.bucketName;
    const namespace = input.data.additionalDetails.namespace;
    const object = input.data.resourceName;

    const client = new os.ObjectStorageClient({
      authenticationDetailsProvider: provider,
    });

    console.log("Fetch the IP JSON File created");
    const getObjectRequest = {
      objectName: object,
      bucketName: bucket,
      namespaceName: namespace,
    };
    const getObjectResponse = await client.getObject(getObjectRequest);
    console.log("Get Object executed successfully.");
    const jsonData = await streamToStringA(getObjectResponse.value);
    const data = JSON.parse(jsonData);
    console.log("new IP", data.ip);

    console.log("Checking if IP is already open");

    //get the sec list for OCI
    const res = await listSecList(
      provider,
      secListRules.compartmentId,
      secListRules.vcnId,
      secListRules.seclistId,
      undefined
    );

    if (res == undefined) {
      console.log(
        `cannot find seclist ${secListRules.seclistId} on vcnId:${secListRules.vcnId}`
      );
      return { message: "bye" };
    }

    const { ingressSecurityRules } = res;

    const currentIpAdd = `${data.ip}/32`;
    let ipAddrFound = false;

    for (const element of ingressSecurityRules) {
      if (element.source == currentIpAdd) {
        ipAddrFound = true;
        break;
      }
    }

    if (ipAddrFound) {
      console.log(`ip ${currentIpAdd} address already in seclist`);
      return { message: "ALREADY" };
    }

    const updRes = await updSecList(
      provider,
      secListRules.seclistId,
      currentIpAdd,
      secListRules.ports,
      ingressSecurityRules
    );

    console.log(`updRes`, JSON.stringify(updRes));

    return { message: "OK" };
  });
};
