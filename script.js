const video = document.getElementById('video')
const button = document.getElementById('logbutton');
const model = '/weights'
// const labelurl = "../labels.json"
const imagefolder = '/labeled_images'
const logactive = true

button.addEventListener("click", logFaceDetection);

var detected = false
var labels = []
var facelabels = new Map()

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(model),
  faceapi.nets.ssdMobilenetv1.loadFromUri(model), // Load ssdMobilenetv1 model
  faceapi.nets.faceLandmark68Net.loadFromUri(model),
  faceapi.nets.faceRecognitionNet.loadFromUri(model),
  faceapi.nets.faceExpressionNet.loadFromUri(model),
  // faceapi.nets.ageGenderNet.loadFromUri(model),
]).then(startVideo)

function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => video.srcObject = stream,
    err => console.error(err)
  )
  
  // Listen for the 'loadeddata' event on the video element
  video.addEventListener('loadeddata', async () => {
    detected = false
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height }
    faceapi.matchDimensions(canvas, displaySize)

    // Create labeled descriptors for known faces
    labels = await getLabels(imagefolder)
    // console.log(labels)
    // labels = ['Trevor', 'Elias', 'Jeremiah', 'Shawn', 'Rusdy', 'Galvin', 'Jeron']
    
    const labeledDescriptors = await Promise.all(
      labels.map(async label => {
          const img = await faceapi.fetchImage(`/labeled_images/${label}.jpg`)
          const detections = await faceapi.detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor()
          return new faceapi.LabeledFaceDescriptors(label, [detections.descriptor])
      })
    )

    // Add face recognition
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5)
    facelabels = new Map()

    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors() // Add face descriptors

      const faceExpression = detections.map((detection) => {
        const expressions = detection.expressions
        const expressionLabel = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
        return expressionLabel
      })

      detected = detections.length > 0

      const resizedDetections = faceapi.resizeResults(detections, displaySize)
      canvas.getContext('2d', { willReadFrequently: true } ).clearRect(0, 0, canvas.width, canvas.height)
      faceapi.draw.drawDetections(canvas, resizedDetections)
      //   faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

      // Recognize faces
      const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor))
      facelabels.clear()
      results.forEach((result, i) => {
        const box = resizedDetections[i].detection.box
        const { label, distance } = result
        facelabels.set(result.label, faceExpression[i])
        const text = `${label} (${(distance * 100).toFixed(2)})`
        const drawBox = new faceapi.draw.DrawBox(box, { label: text })
        drawBox.draw(canvas)
      })
    }, 100)

    // setInterval(async () => {
    //   if(detected){
    //     console.log(facelabels)
    //     if(logactive){
    //       for(let l = 0; l < facelabels.size; l++){
    //         let name = [...facelabels.keys()]
    //         console.log(facelabels)
    //         try {
    //           const response = await axios.post("https://sheetdb.io/api/v1/zjvg729trjd7s", {
    //             "sheet": "Sheet1",
    //             "data": {
    //               "Date": "DATETIME",
    //               "Name": name[l],
    //               "Expression": facelabels.get(name[l])
    //             }
    //           });
    //           console.log(response);
    //         } catch (error) {
    //           console.error(error);
    //         }
    //       }
    //     }
    //   }
    //   console.log("10s")
    // }, 10000);
  })
}

async function logFaceDetection() {
  if (detected) {
    labels = await getLabels(imagefolder)
    console.log(facelabels);
    if (logactive) {
      for (let l = 0; l < facelabels.size; l++) {
        let name = [...facelabels.keys()];
        console.log(facelabels);
        try {
          const response = await axios.post(
            "https://sheetdb.io/api/v1/zjvg729trjd7s",
            {
              sheet: "Log",
              data: {
                Date: "DATETIME",
                Name: name[l],
                Expression: facelabels.get(name[l]),
              },
            }
          );
          console.log(response);
        } catch (error) {
          console.error(error);
        }
      }
    }
  }
  console.log("Face detection logged.");
}

function getLabels(folderPath){
  return fetch(folderPath)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.text();
    })
    .then(html => {
      // Parse the HTML response to get the filenames
      const imageFilenames = Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a'))
                            .map(link => link.textContent)
                            // .filter(filename => /\.(jpg|jpeg|png|gif)$/i.test(filename))
                            .map(filename => filename.slice(0, filename.lastIndexOf('.')))
                            .slice(3);
      return imageFilenames;
    })
    .catch(error => {
      console.error('There was a problem fetching the folder contents:', error);
    });
}


async function extractUnknownFace(inputImage, box){
  const regionsToExtract = [
    new faceapi.Rect( box.x, box.y, box.width, box.height )
  ]

  let faceImages = await faceapi.extractFaces(inputImage, regionsToExtract)

  if(faceImages.length == 0){
    console.log('Face not Found')
  }
  else{

    //TODO saveFaceImage as reference
    console.log(faceImages.length)
  }
}