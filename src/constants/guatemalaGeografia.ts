/**
 * Catálogo oficial de departamentos y municipios de Guatemala (INE).
 * Fuente: plantilla oficial IGSS v2.2.0 (hoja "DEPTOS. Y MUNICIPIOS").
 * Los códigos de 2 dígitos son los que exige el archivo de planilla electrónica IGSS.
 */

export interface Municipio { code: string; name: string }
export interface Departamento { code: string; name: string; municipios: Municipio[] }

export const DEPARTAMENTOS_GUATEMALA: Departamento[] = [
  {
    "code": "01",
    "name": "Guatemala",
    "municipios": [
      {
        "code": "01",
        "name": "Guatemala"
      },
      {
        "code": "02",
        "name": "Santa Catarina Pinula"
      },
      {
        "code": "03",
        "name": "San José Pinula"
      },
      {
        "code": "04",
        "name": "San José del Golfo"
      },
      {
        "code": "05",
        "name": "Palencia"
      },
      {
        "code": "06",
        "name": "Chinautla"
      },
      {
        "code": "07",
        "name": "San Pedro Ayampuc"
      },
      {
        "code": "08",
        "name": "Mixco"
      },
      {
        "code": "09",
        "name": "San Pedro Sacatepéquez"
      },
      {
        "code": "10",
        "name": "San Juan Sacatepéquez"
      },
      {
        "code": "11",
        "name": "San Raymundo"
      },
      {
        "code": "12",
        "name": "Chuarrancho"
      },
      {
        "code": "13",
        "name": "Fraijanes"
      },
      {
        "code": "14",
        "name": "Amatitlán"
      },
      {
        "code": "15",
        "name": "Villa Nueva"
      },
      {
        "code": "16",
        "name": "Villa Canales"
      },
      {
        "code": "17",
        "name": "Petapa"
      }
    ]
  },
  {
    "code": "02",
    "name": "El Progreso",
    "municipios": [
      {
        "code": "01",
        "name": "Guastatoya"
      },
      {
        "code": "02",
        "name": "Morazán"
      },
      {
        "code": "03",
        "name": "San Agustín Acasaguastlán"
      },
      {
        "code": "04",
        "name": "San Cristóbal Acasaguastlán"
      },
      {
        "code": "05",
        "name": "El Jícaro"
      },
      {
        "code": "06",
        "name": "Sansare"
      },
      {
        "code": "07",
        "name": "Sanarate"
      },
      {
        "code": "08",
        "name": "San Antonio La Paz"
      }
    ]
  },
  {
    "code": "03",
    "name": "Sacatepéquez",
    "municipios": [
      {
        "code": "01",
        "name": "Antigua Guatemala"
      },
      {
        "code": "02",
        "name": "Jocotenango"
      },
      {
        "code": "03",
        "name": "Pastores"
      },
      {
        "code": "04",
        "name": "Sumpango"
      },
      {
        "code": "05",
        "name": "Santo Domingo Xenacoj"
      },
      {
        "code": "06",
        "name": "Santiago Sacatepéquez"
      },
      {
        "code": "07",
        "name": "San Bartolomé Milpas Altas"
      },
      {
        "code": "08",
        "name": "San Lucas Sacatepéquez"
      },
      {
        "code": "09",
        "name": "Santa Lucía Milpas Altas"
      },
      {
        "code": "10",
        "name": "Magdalena Milpas Altas"
      },
      {
        "code": "11",
        "name": "Santa María de Jesús"
      },
      {
        "code": "12",
        "name": "Ciudad Vieja"
      },
      {
        "code": "13",
        "name": "San Miguel Dueñas"
      },
      {
        "code": "14",
        "name": "Alotenango"
      },
      {
        "code": "15",
        "name": "San Antonio Aguas Calientes"
      },
      {
        "code": "16",
        "name": "Santa Catarina Barahona"
      }
    ]
  },
  {
    "code": "04",
    "name": "Chimaltenango",
    "municipios": [
      {
        "code": "01",
        "name": "Chimaltenango"
      },
      {
        "code": "02",
        "name": "San José Poaquil"
      },
      {
        "code": "03",
        "name": "San Martín Jilotepéque"
      },
      {
        "code": "04",
        "name": "Comalapa"
      },
      {
        "code": "05",
        "name": "Santa Apolonia"
      },
      {
        "code": "06",
        "name": "Tecpán Guatemala"
      },
      {
        "code": "07",
        "name": "Patzún"
      },
      {
        "code": "08",
        "name": "Pochuta"
      },
      {
        "code": "09",
        "name": "Patzicía"
      },
      {
        "code": "10",
        "name": "Santa Cruz Balanyá"
      },
      {
        "code": "11",
        "name": "Acatenango"
      },
      {
        "code": "12",
        "name": "Yepocapa"
      },
      {
        "code": "13",
        "name": "San Andrés Itzapa"
      },
      {
        "code": "14",
        "name": "Parramos"
      },
      {
        "code": "15",
        "name": "Zaragoza"
      },
      {
        "code": "16",
        "name": "El Tejar"
      }
    ]
  },
  {
    "code": "05",
    "name": "Escuintla",
    "municipios": [
      {
        "code": "01",
        "name": "Escuintla"
      },
      {
        "code": "02",
        "name": "Santa Lucía Cotzumalguapa"
      },
      {
        "code": "03",
        "name": "La Democracia"
      },
      {
        "code": "04",
        "name": "Siquinalá"
      },
      {
        "code": "05",
        "name": "Masagua"
      },
      {
        "code": "06",
        "name": "Tiquisate"
      },
      {
        "code": "07",
        "name": "La Gomera"
      },
      {
        "code": "08",
        "name": "Guanagazapa"
      },
      {
        "code": "09",
        "name": "San José"
      },
      {
        "code": "10",
        "name": "Iztapa"
      },
      {
        "code": "11",
        "name": "Palín"
      },
      {
        "code": "12",
        "name": "San Vicente Pacaya"
      },
      {
        "code": "13",
        "name": "Nueva Concepción"
      }
    ]
  },
  {
    "code": "06",
    "name": "Santa Rosa",
    "municipios": [
      {
        "code": "01",
        "name": "Cuilapa"
      },
      {
        "code": "02",
        "name": "Barberena"
      },
      {
        "code": "03",
        "name": "Santa Rosa de Lima"
      },
      {
        "code": "04",
        "name": "Casillas"
      },
      {
        "code": "05",
        "name": "San Rafael Las Flores"
      },
      {
        "code": "06",
        "name": "Oratorio"
      },
      {
        "code": "07",
        "name": "San Juan Tecuaco"
      },
      {
        "code": "08",
        "name": "Chiquimulilla"
      },
      {
        "code": "09",
        "name": "Taxisco"
      },
      {
        "code": "10",
        "name": "Santa Maria Ixhuatán"
      },
      {
        "code": "11",
        "name": "Guazacapán"
      },
      {
        "code": "12",
        "name": "Santa Cruz Naranjo"
      },
      {
        "code": "13",
        "name": "Pueblo Nuevo Viñas"
      },
      {
        "code": "14",
        "name": "Nueva Santa Rosa"
      }
    ]
  },
  {
    "code": "07",
    "name": "Sololá",
    "municipios": [
      {
        "code": "01",
        "name": "Sololá"
      },
      {
        "code": "02",
        "name": "San José Chacayá"
      },
      {
        "code": "03",
        "name": "Santa María Visitación"
      },
      {
        "code": "04",
        "name": "Santa Lucía Utatlán"
      },
      {
        "code": "05",
        "name": "Nahualá"
      },
      {
        "code": "06",
        "name": "Santa Catarina Ixtahuacán"
      },
      {
        "code": "07",
        "name": "Santa Clara La Laguna"
      },
      {
        "code": "08",
        "name": "Concepción"
      },
      {
        "code": "09",
        "name": "San Andrés Semetabaj"
      },
      {
        "code": "10",
        "name": "Panajachel"
      },
      {
        "code": "11",
        "name": "Santa Catarina Palopó"
      },
      {
        "code": "12",
        "name": "San Antonio Palopó"
      },
      {
        "code": "13",
        "name": "San Lucas Tolimán"
      },
      {
        "code": "14",
        "name": "Santa Cruz La Laguna"
      },
      {
        "code": "15",
        "name": "San Pablo La Laguna"
      },
      {
        "code": "16",
        "name": "San Marcos La Laguna"
      },
      {
        "code": "17",
        "name": "San Juan La Laguna"
      },
      {
        "code": "18",
        "name": "San Pedro La Laguna"
      },
      {
        "code": "19",
        "name": "Santiago Atitlán"
      }
    ]
  },
  {
    "code": "08",
    "name": "Totonicapán",
    "municipios": [
      {
        "code": "01",
        "name": "Totonicapán"
      },
      {
        "code": "02",
        "name": "San Cristóbal Totonicapán"
      },
      {
        "code": "03",
        "name": "San Francisco El Alto"
      },
      {
        "code": "04",
        "name": "San Andrés Xecul"
      },
      {
        "code": "05",
        "name": "Momostenango"
      },
      {
        "code": "06",
        "name": "Santa María Chiquimula"
      },
      {
        "code": "07",
        "name": "Santa Lucía La Reforma"
      },
      {
        "code": "08",
        "name": "San Bartolo"
      }
    ]
  },
  {
    "code": "09",
    "name": "Quezaltenango",
    "municipios": [
      {
        "code": "01",
        "name": "Quezaltenango"
      },
      {
        "code": "02",
        "name": "Salcajá"
      },
      {
        "code": "03",
        "name": "Olintepéque"
      },
      {
        "code": "04",
        "name": "San Carlos Sija"
      },
      {
        "code": "05",
        "name": "Sibilia"
      },
      {
        "code": "06",
        "name": "Cabricán"
      },
      {
        "code": "07",
        "name": "Cajolá"
      },
      {
        "code": "08",
        "name": "San Miguel Sigüilá"
      },
      {
        "code": "09",
        "name": "Ostuncalco"
      },
      {
        "code": "10",
        "name": "San Mateo"
      },
      {
        "code": "11",
        "name": "Concepción Chiquirichapa"
      },
      {
        "code": "12",
        "name": "San Martín Sacatepéquez"
      },
      {
        "code": "13",
        "name": "Almolonga"
      },
      {
        "code": "14",
        "name": "Cantel"
      },
      {
        "code": "15",
        "name": "Huitán"
      },
      {
        "code": "16",
        "name": "Zunil"
      },
      {
        "code": "17",
        "name": "Colomba"
      },
      {
        "code": "18",
        "name": "San Francisco La Unión"
      },
      {
        "code": "19",
        "name": "El Palmar"
      },
      {
        "code": "20",
        "name": "Coatepeque"
      },
      {
        "code": "21",
        "name": "Génova"
      },
      {
        "code": "22",
        "name": "Flores Costa Cuca"
      },
      {
        "code": "23",
        "name": "La Esperanza"
      },
      {
        "code": "24",
        "name": "Palestina de los Altos"
      }
    ]
  },
  {
    "code": "10",
    "name": "Suchitepéquez",
    "municipios": [
      {
        "code": "01",
        "name": "Mazatenango"
      },
      {
        "code": "02",
        "name": "Cuyotenango"
      },
      {
        "code": "03",
        "name": "San Francisco Zapotitlán"
      },
      {
        "code": "04",
        "name": "San Bernardino"
      },
      {
        "code": "05",
        "name": "San José El Ídolo"
      },
      {
        "code": "06",
        "name": "Santo Domingo Suchitepéquez"
      },
      {
        "code": "07",
        "name": "San Lorenzo"
      },
      {
        "code": "08",
        "name": "Samayac"
      },
      {
        "code": "09",
        "name": "San Pablo Jocopilas"
      },
      {
        "code": "10",
        "name": "San Antonio Suchitepéquez"
      },
      {
        "code": "11",
        "name": "San Miguel Panán"
      },
      {
        "code": "12",
        "name": "San Gabriel"
      },
      {
        "code": "13",
        "name": "Chicacao"
      },
      {
        "code": "14",
        "name": "Patulul"
      },
      {
        "code": "15",
        "name": "Santa Bárbara"
      },
      {
        "code": "16",
        "name": "San Juan Bautista"
      },
      {
        "code": "17",
        "name": "Santo Tomas La Unión"
      },
      {
        "code": "18",
        "name": "Zunilito"
      },
      {
        "code": "19",
        "name": "Pueblo Nuevo"
      },
      {
        "code": "20",
        "name": "Río Bravo"
      }
    ]
  },
  {
    "code": "11",
    "name": "Retalhuleu",
    "municipios": [
      {
        "code": "01",
        "name": "Retalhuleu"
      },
      {
        "code": "02",
        "name": "San Sebastián"
      },
      {
        "code": "03",
        "name": "Santa Cruz Muluá"
      },
      {
        "code": "04",
        "name": "San Martín Zapotitlán"
      },
      {
        "code": "05",
        "name": "San Felipe"
      },
      {
        "code": "06",
        "name": "San Andrés Villa Seca"
      },
      {
        "code": "07",
        "name": "Champerico"
      },
      {
        "code": "08",
        "name": "Nuevo San Carlos"
      },
      {
        "code": "09",
        "name": "El Asintal"
      }
    ]
  },
  {
    "code": "12",
    "name": "San Marcos",
    "municipios": [
      {
        "code": "01",
        "name": "San Marcos"
      },
      {
        "code": "02",
        "name": "San Pedro Sacatepéquez"
      },
      {
        "code": "03",
        "name": "San Antonio Sacatepéquez"
      },
      {
        "code": "04",
        "name": "Comitancillo"
      },
      {
        "code": "05",
        "name": "San Miguel Ixtahuacán"
      },
      {
        "code": "06",
        "name": "Concepción Tutuapa"
      },
      {
        "code": "07",
        "name": "Tacaná"
      },
      {
        "code": "08",
        "name": "Sibinal"
      },
      {
        "code": "09",
        "name": "Tajumulco"
      },
      {
        "code": "10",
        "name": "Tejutla"
      },
      {
        "code": "11",
        "name": "San Rafael Pie de la Cuesta"
      },
      {
        "code": "12",
        "name": "Nuevo Progreso"
      },
      {
        "code": "13",
        "name": "El Tumbador"
      },
      {
        "code": "14",
        "name": "El Rodeo"
      },
      {
        "code": "15",
        "name": "Malacatán"
      },
      {
        "code": "16",
        "name": "Catarina"
      },
      {
        "code": "17",
        "name": "Ayutla"
      },
      {
        "code": "18",
        "name": "Ocós"
      },
      {
        "code": "19",
        "name": "San Pablo"
      },
      {
        "code": "20",
        "name": "El Quetzal"
      },
      {
        "code": "21",
        "name": "La Reforma"
      },
      {
        "code": "22",
        "name": "Pajapita"
      },
      {
        "code": "23",
        "name": "Ixchiguán"
      },
      {
        "code": "24",
        "name": "San José Ojetenam"
      },
      {
        "code": "25",
        "name": "San Cristóbal Cucho"
      },
      {
        "code": "26",
        "name": "Sipacapa"
      },
      {
        "code": "27",
        "name": "Esquipulas Palo Gordo"
      },
      {
        "code": "28",
        "name": "Río Blanco"
      },
      {
        "code": "29",
        "name": "San Lorenzo"
      }
    ]
  },
  {
    "code": "13",
    "name": "Huehuetenango",
    "municipios": [
      {
        "code": "01",
        "name": "Huehuetenango"
      },
      {
        "code": "02",
        "name": "Chiantla"
      },
      {
        "code": "03",
        "name": "Malacatancito"
      },
      {
        "code": "04",
        "name": "Cuilco"
      },
      {
        "code": "05",
        "name": "Nentón"
      },
      {
        "code": "06",
        "name": "San Pedro Necta"
      },
      {
        "code": "07",
        "name": "Jacaltenango"
      },
      {
        "code": "08",
        "name": "Soloma"
      },
      {
        "code": "09",
        "name": "Ixtahuacán"
      },
      {
        "code": "10",
        "name": "Santa Bárbara"
      },
      {
        "code": "11",
        "name": "La Libertad"
      },
      {
        "code": "12",
        "name": "La Democracia"
      },
      {
        "code": "13",
        "name": "San Miguel Acatán"
      },
      {
        "code": "14",
        "name": "San Rafael La Independencia"
      },
      {
        "code": "15",
        "name": "Todos Santos Cuchumatán"
      },
      {
        "code": "16",
        "name": "San Juan Atitán"
      },
      {
        "code": "17",
        "name": "Santa Eulalia"
      },
      {
        "code": "18",
        "name": "San Mateo Ixtatán"
      },
      {
        "code": "19",
        "name": "Colotenango"
      },
      {
        "code": "20",
        "name": "San Sebastián Huehuetenango"
      },
      {
        "code": "21",
        "name": "Tectitán"
      },
      {
        "code": "22",
        "name": "Concepción"
      },
      {
        "code": "23",
        "name": "San Juan Ixcoy"
      },
      {
        "code": "24",
        "name": "San Antonio Huista"
      },
      {
        "code": "25",
        "name": "San Sebastian Coatán"
      },
      {
        "code": "26",
        "name": "Barillas"
      },
      {
        "code": "27",
        "name": "Aguacatán"
      },
      {
        "code": "28",
        "name": "San Rafael Petzal"
      },
      {
        "code": "29",
        "name": "San Gaspar Ixchil"
      },
      {
        "code": "30",
        "name": "Santiago Chimaltenango"
      },
      {
        "code": "31",
        "name": "Santa Ana Huista"
      },
      {
        "code": "32",
        "name": "La Unión Cantinil"
      }
    ]
  },
  {
    "code": "14",
    "name": "Quiché",
    "municipios": [
      {
        "code": "01",
        "name": "Santa Cruz del Quiché"
      },
      {
        "code": "02",
        "name": "Chiché"
      },
      {
        "code": "03",
        "name": "Chinique"
      },
      {
        "code": "04",
        "name": "Zacualpa"
      },
      {
        "code": "05",
        "name": "Chajul"
      },
      {
        "code": "06",
        "name": "Chichicastenango"
      },
      {
        "code": "07",
        "name": "Patzité"
      },
      {
        "code": "08",
        "name": "San Antonio Ilotenango"
      },
      {
        "code": "09",
        "name": "San Pedro Jocopilas"
      },
      {
        "code": "10",
        "name": "Cunén"
      },
      {
        "code": "11",
        "name": "San Juan Cotzal"
      },
      {
        "code": "12",
        "name": "Joyabaj"
      },
      {
        "code": "13",
        "name": "Nebaj"
      },
      {
        "code": "14",
        "name": "San Andrés Sajcabajá"
      },
      {
        "code": "15",
        "name": "Uspantán"
      },
      {
        "code": "16",
        "name": "Sacapulas"
      },
      {
        "code": "17",
        "name": "San Bartolomé Jocotenango"
      },
      {
        "code": "18",
        "name": "Canillá"
      },
      {
        "code": "19",
        "name": "Chicamán"
      },
      {
        "code": "20",
        "name": "Ixcán Playa Grande"
      },
      {
        "code": "21",
        "name": "Pachalum"
      }
    ]
  },
  {
    "code": "15",
    "name": "Baja Verapáz",
    "municipios": [
      {
        "code": "01",
        "name": "Salamá"
      },
      {
        "code": "02",
        "name": "San Miguel Chicaj"
      },
      {
        "code": "03",
        "name": "Rabinal"
      },
      {
        "code": "04",
        "name": "Cubulco"
      },
      {
        "code": "05",
        "name": "Granados"
      },
      {
        "code": "06",
        "name": "El Chol"
      },
      {
        "code": "07",
        "name": "San Jerónimo"
      },
      {
        "code": "08",
        "name": "Purulhá"
      }
    ]
  },
  {
    "code": "16",
    "name": "Alta Verapáz",
    "municipios": [
      {
        "code": "01",
        "name": "Cobán"
      },
      {
        "code": "02",
        "name": "Santa Cruz Verapáz"
      },
      {
        "code": "03",
        "name": "San Cristóbal Verapáz"
      },
      {
        "code": "04",
        "name": "Tactic"
      },
      {
        "code": "05",
        "name": "Tamahú"
      },
      {
        "code": "06",
        "name": "Tucurú"
      },
      {
        "code": "07",
        "name": "Panzós"
      },
      {
        "code": "08",
        "name": "Senahú"
      },
      {
        "code": "09",
        "name": "San Pedro Carchá"
      },
      {
        "code": "10",
        "name": "San Juan Chamelco"
      },
      {
        "code": "11",
        "name": "Lanquín"
      },
      {
        "code": "12",
        "name": "Cahabón"
      },
      {
        "code": "13",
        "name": "Chisec"
      },
      {
        "code": "14",
        "name": "Chahal"
      },
      {
        "code": "15",
        "name": "Fray Bartolomé de las Casas"
      },
      {
        "code": "16",
        "name": "La Tinta"
      }
    ]
  },
  {
    "code": "17",
    "name": "Petén",
    "municipios": [
      {
        "code": "01",
        "name": "Flores"
      },
      {
        "code": "02",
        "name": "San José"
      },
      {
        "code": "03",
        "name": "San Benito"
      },
      {
        "code": "04",
        "name": "San Andrés"
      },
      {
        "code": "05",
        "name": "La Libertad"
      },
      {
        "code": "06",
        "name": "San Francisco"
      },
      {
        "code": "07",
        "name": "Santa Ana"
      },
      {
        "code": "08",
        "name": "Dolores"
      },
      {
        "code": "09",
        "name": "San Luis"
      },
      {
        "code": "10",
        "name": "Sayaxché"
      },
      {
        "code": "11",
        "name": "Melchor de Mencos"
      },
      {
        "code": "12",
        "name": "Poptún"
      }
    ]
  },
  {
    "code": "18",
    "name": "Izabal",
    "municipios": [
      {
        "code": "01",
        "name": "Puerto Barrios"
      },
      {
        "code": "02",
        "name": "Livingston"
      },
      {
        "code": "03",
        "name": "El Estor"
      },
      {
        "code": "04",
        "name": "Morales"
      },
      {
        "code": "05",
        "name": "Los Amates"
      }
    ]
  },
  {
    "code": "19",
    "name": "Zacapa",
    "municipios": [
      {
        "code": "01",
        "name": "Zacapa"
      },
      {
        "code": "02",
        "name": "Estanzuela"
      },
      {
        "code": "03",
        "name": "Río Hondo"
      },
      {
        "code": "04",
        "name": "Gualán"
      },
      {
        "code": "05",
        "name": "Teculután"
      },
      {
        "code": "06",
        "name": "Usumatlán"
      },
      {
        "code": "07",
        "name": "Cabañas"
      },
      {
        "code": "08",
        "name": "San Diego"
      },
      {
        "code": "09",
        "name": "La Unión"
      },
      {
        "code": "10",
        "name": "Huité"
      }
    ]
  },
  {
    "code": "20",
    "name": "Chiquimula",
    "municipios": [
      {
        "code": "01",
        "name": "Chiquimula"
      },
      {
        "code": "02",
        "name": "San José La Arada"
      },
      {
        "code": "03",
        "name": "San Juan Ermita"
      },
      {
        "code": "04",
        "name": "Jocotán"
      },
      {
        "code": "05",
        "name": "Camotán"
      },
      {
        "code": "06",
        "name": "Olopa"
      },
      {
        "code": "07",
        "name": "Esquipulas"
      },
      {
        "code": "08",
        "name": "Concepción Las Minas"
      },
      {
        "code": "09",
        "name": "Quezaltepeque"
      },
      {
        "code": "10",
        "name": "San Jacinto"
      },
      {
        "code": "11",
        "name": "Ipala"
      }
    ]
  },
  {
    "code": "21",
    "name": "Jalapa",
    "municipios": [
      {
        "code": "01",
        "name": "Jalapa"
      },
      {
        "code": "02",
        "name": "San Pedro Pinula"
      },
      {
        "code": "03",
        "name": "San Luis Jilotepeque"
      },
      {
        "code": "04",
        "name": "San Manuel Chaparrón"
      },
      {
        "code": "05",
        "name": "San Carlos Alzatate"
      },
      {
        "code": "06",
        "name": "Monjas"
      },
      {
        "code": "07",
        "name": "Mataquescuintla"
      }
    ]
  },
  {
    "code": "22",
    "name": "Jutiapa",
    "municipios": [
      {
        "code": "01",
        "name": "Jutiapa"
      },
      {
        "code": "02",
        "name": "El Progreso"
      },
      {
        "code": "03",
        "name": "Santa Catarina Mita"
      },
      {
        "code": "04",
        "name": "Agua Blanca"
      },
      {
        "code": "05",
        "name": "Asunción Mita"
      },
      {
        "code": "06",
        "name": "Yupiltepeque"
      },
      {
        "code": "07",
        "name": "Atescatempa"
      },
      {
        "code": "08",
        "name": "Jeréz"
      },
      {
        "code": "09",
        "name": "El Adelanto"
      },
      {
        "code": "10",
        "name": "Zapotitlán"
      },
      {
        "code": "11",
        "name": "Comapa"
      },
      {
        "code": "12",
        "name": "Jalpatagua"
      },
      {
        "code": "13",
        "name": "Conguaco"
      },
      {
        "code": "14",
        "name": "Moyuta"
      },
      {
        "code": "15",
        "name": "Pasaco"
      },
      {
        "code": "16",
        "name": "San José Acatempa"
      },
      {
        "code": "17",
        "name": "Quezada"
      }
    ]
  }
]
