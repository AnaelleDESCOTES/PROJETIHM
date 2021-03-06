import { Injectable } from '@angular/core';
import {CabinetInterface} from './dataInterfaces/cabinet';
import {HttpClient, HttpResponse} from '@angular/common/http';
import {Adresse} from './dataInterfaces/adresse';
import {InfirmierInterface} from './dataInterfaces/infirmier';
import {PatientInterface} from './dataInterfaces/patient';
import {sexeEnum} from './dataInterfaces/sexe';

@Injectable({
  providedIn: 'root'
})
export class CabinetMedicalService {

  private cab: CabinetInterface;

  constructor(private _http: HttpClient) {
    this.getCabinet();
    console.log(this.cab);
  }
  get cabinet(): CabinetInterface {
    return this.cab;
  }
  private async getCabinet() {
    this.cab = await this.getData('/data/cabinetInfirmier.xml');
  }

  async affecterPatient(i: string, p: PatientInterface) {
    let inf: InfirmierInterface;
    this.cab.infirmiers.forEach((e) => {
        if (e.id === i) {
          inf = e;
        }
    });
    console.log('PATIENT : ' + p.numéroSécuritéSociale);
    console.log('INFIRM : ' + inf.id);
    const res = await this._http.post('/affectation', {
      infirmier : inf.id,
      patient :  p.numéroSécuritéSociale
    }, {observe: 'response'}).toPromise<HttpResponse<any>>();
    console.log('Add patient renvoie', res);
    if (res.status === 200) {
      // OK on peut ajouter en local
      inf.patients.push(p);
      this.cabinet.patientsNonAffectés = this.patientsNonAffectes.filter( pat => p !== pat );
    }
    return null;
  }

  async desaffecterPatient(inf: InfirmierInterface, pat: string) {
    let patient: PatientInterface;
    // je cherche le patient dans la liste de infirmier grace au numéro de securité sociale
    inf.patients.forEach( (p) => {
      if (p.numéroSécuritéSociale === pat) {
        patient = p;
      }
    });
    const res = await this._http.post( '/affectation', {
        infirmier: 'none',
        patient: patient.numéroSécuritéSociale
  }, {observe: 'response'}).toPromise<HttpResponse<any>>();
    // j'enleve le patient de la lsite de l'ancien infirmier
    if (res.status === 200) {
      // OK on peut ajouter en local
      this.addPatient(patient);
      const index = inf.patients.indexOf(patient);
      inf.patients.splice(index, index + 1);
    }
    // j'ajoute le patient à la liste des patietns non affectés

    return null;
  }

  async reaffecterPatient(ancien: InfirmierInterface, pat: string, nouveau: string) {
    let patient: PatientInterface;
    let infirmier: InfirmierInterface;
    // je cherche le patient dans la liste de lancien infirmier grace au numéro de securité sociale
    ancien.patients.forEach(p => {
      if (p.numéroSécuritéSociale === pat) {
        patient = p;
      }
    });

    // je l'ajoute au nouveau
    this.infirmiers.forEach(i => {
      if (i.id === nouveau) {
        infirmier = i;
      }
    });
    const res = await this._http.post('/affectation', {
      infirmier: infirmier.id,
      patient: patient.numéroSécuritéSociale
    }, {observe: 'response'}).toPromise<HttpResponse<any>>();
    if (res.status === 200) {
      // OK on peut ajouter en local
      // j'enleve le patient de la lsite de l'ancien infirmier
      const index = ancien.patients.indexOf(patient);
      ancien.patients.splice(index, index + 1);
      infirmier.patients.push(patient);
    }
  }

  public creerPatient(prenom: string, nom: string, sexe: sexeEnum, etage: string, numero: string, rue: string, ville: string, codePostal: number, securiteSocial: string ) {
    const p: PatientInterface = {
        prénom: '',
        nom: '',
        sexe: sexeEnum.M ,
        adresse: {
        étage: '',
        codePostal: 0,
        numéro: '',
        rue: '',
        ville: '',
      },
      numéroSécuritéSociale: ''
    };
    p.prénom = prenom ;
    p.nom = nom;
    p.sexe = sexe;
    p.adresse.étage = etage;
    p.adresse.numéro = numero;
    p.adresse.rue = rue;
    p.adresse.ville = ville;
    p.adresse.codePostal = codePostal;
    p.numéroSécuritéSociale = securiteSocial;
    this.addPatient(p);
  }



  public async addPatient(patient: PatientInterface): Promise<PatientInterface> {
    const res = await this._http.post('/addPatient', {
      patientName: patient.nom,
      patientForname: patient.prénom,
      patientNumber: patient.numéroSécuritéSociale,
      patientSex: patient.sexe === sexeEnum.M ? 'M' : 'F',
      patientFloor: patient.adresse.étage,
      patientStreetNumber: patient.adresse.numéro,
      patientStreet: patient.adresse.rue,
      patientPostalCode: patient.adresse.codePostal,
      patientCity: patient.adresse.ville
    }, {observe: 'response'}).toPromise<HttpResponse<any>>();

    console.log('Add patient renvoie', res);
    if (res.status === 200) {
      // OK on peut ajouter en local
      this.cab.patientsNonAffectés.push( patient );
    }
    return null;
  }

  private getAdresseFrom(adXML: Element): Adresse {
    let n;
    return {
      étage: (n = adXML.querySelector('étage')) ? n.textContent : undefined,
      numéro: (n = adXML.querySelector('numéro')) ? n.textContent : undefined,
      rue: (n = adXML.querySelector('rue')) ? n.textContent : undefined,
      ville: (n = adXML.querySelector('ville')) ? n.textContent : undefined,
      codePostal: (n = adXML.querySelector('codePostal')) ? n.textContent : -1
    };
  }

  async getData(url: string): Promise<CabinetInterface> {
    const cab: CabinetInterface = {
      infirmiers: [],
      patientsNonAffectés: [],
      adresse: undefined,
    };
    try {
      const res: HttpResponse<string> = await this._http.get(url, {observe: 'response', responseType: 'text'}).toPromise();
      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'text/xml');
      // @ts-ignore
      const LInfXML = Array.from( doc.querySelectorAll('infirmiers infirmier') );

      const infirmiers: InfirmierInterface[] = LInfXML.map(infXML => ({
          patients: [],
          id: infXML.getAttribute('id'),
          nom: infXML.querySelector('nom').textContent,
          prénom: infXML.querySelector('prénom').textContent,
          photo: infXML.querySelector('photo').textContent,
          adresse: this.getAdresseFrom(infXML.querySelector('adresse'))
      }));
      cab.infirmiers = infirmiers;

      const LPatXML = Array.from( doc.querySelectorAll('patients patient') );
      // @ts-ignore
      const patients: PatientInterface[] = LPatXML.map(patXML => ({
          nom: patXML.querySelector('nom').textContent,
          prénom: patXML.querySelector('prénom').textContent,
          sexe: patXML.querySelector('sexe').textContent,
          numéroSécuritéSociale: patXML.querySelector('numéro').textContent,
          adresse: this.getAdresseFrom(patXML.querySelector('adresse'))
      }));

      const affectations = LPatXML.map((patXML, i) => {
        let n;
        const infId = (n = patXML.querySelector('visite[intervenant]')) ? n.getAttribute('intervenant') : undefined;
        return {
          patient: patients[i],
          infirmier: infirmiers.find(inf => inf.id === infId)
        };
      });

      affectations.forEach(aff => {
        const inf = aff.infirmier;
        const pat = aff.patient;
        if (inf) {
          inf.patients.push(pat);
        } else {
          cab.patientsNonAffectés.push(pat);
        }
      });
      console.log(cab);

    console.log(doc);
    } catch (err) {
      console.error('ERROR in getData', err);
    }
    return cab;
  }

  get patientsNonAffectes(): PatientInterface[] {
    return this.cab ? this.cab.patientsNonAffectés : [];
  }

  get infirmiers(): InfirmierInterface[] {
    return this.cab ? this.cab.infirmiers : [];
  }



}
