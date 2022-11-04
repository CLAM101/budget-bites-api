# instructions for docker to follow when building the docker image

FROM node:alpine

# directory name that all files are copied to 
WORKDIR /foodappbackenddocker
# in struction to copy package .json file
COPY package*.json .
# instruction to install all dependancies
RUN npm ci
# instruction to copy all files in the directory to the image
COPY . .
# instruction to start the application
CMD ["npm", "run", "dev"]

