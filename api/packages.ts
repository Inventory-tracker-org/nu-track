import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  ActivityIndicator, 
  Alert 
} from 'react-native';

const formData = new FormData();

formData.append('barcode', barcode);
formData.append('date', date);
formData.append('time', time);
formData.append('comment', comment);
formData.append('lastName', deliveredTo);
formData.append('latitude', String(latitude));
formData.append('longitude', String(longitude));

formData.append('photo', {
    uri: photoUri,
    name: 'package-photo.jpg',
    type: 'image/jpeg',
} as any);

formData.append('signature', {
    uri: signatureUri,
    name: 'signature.png',
    type: 'image/png',
} as any);

const response = await fetch(
    'https://dataworks-7b7x.onrender.com/api/create-package.php',
    {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    }
);